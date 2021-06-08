import {Timings} from '@feltcoop/felt/utils/time.js';
import {print_timings} from '@feltcoop/felt/utils/print.js';
import {print_spawn_result, spawn_process} from '@feltcoop/felt/utils/process.js';
import {EMPTY_OBJECT} from '@feltcoop/felt/utils/object.js';
import {strip_trailing_slash} from '@feltcoop/felt/utils/path.js';

import type {Adapter} from './adapter.js';
import {Task_Error} from '../task/task.js';
import {copy_dist} from '../build/dist.js';
import {
	paths,
	source_id_to_base_path,
	SOURCE_DIRNAME,
	to_build_extension,
	to_import_id,
	TS_TYPEMAP_EXTENSION,
	TS_TYPE_EXTENSION,
} from '../paths.js';
import {NODE_LIBRARY_BUILD_NAME} from '../build/default_build_config.js';
import type {Build_Name} from '../build/build_config.js';
import {print_build_config_label, to_input_files} from '../build/build_config.js';
import {runRollup} from '../build/rollup.js';
import type {Map_Input_Options, Map_Output_Options, Map_Watch_Options} from '../build/rollup.js';
import type {Path_Stats} from '../fs/path_data.js';

// TODO maybe add a `files` option to explicitly include source files,
// and fall back to inferring from the build config
// (it should probably accept the normal include/exclude filters from @rollup/pluginutils)

export interface Options {
	build_name: Build_Name; // defaults to 'library'
	dir: string; // defaults to `dist/${build_name}`
	type: 'unbundled' | 'bundled'; // defaults to 'unbundled'
	link: string | null; // path to `npm link`, defaults to null
	// TODO currently these options are only available for 'bundled'
	esm: boolean; // defaults to true
	cjs: boolean; // defaults to true
	pack: boolean; // treat the dist as a package to be published - defaults to true
}

interface AdapterArgs {
	map_input_options: Map_Input_Options;
	map_output_options: Map_Output_Options;
	map_watch_options: Map_Watch_Options;
}

export const create_adapter = ({
	build_name = NODE_LIBRARY_BUILD_NAME,
	dir = `${paths.dist}${build_name}`,
	type = 'unbundled',
	link = null,
	esm = true,
	cjs = true,
	pack = true,
}: Partial<Options> = EMPTY_OBJECT): Adapter<AdapterArgs> => {
	dir = strip_trailing_slash(dir);
	return {
		name: '@feltcoop/gro-adapter-node-library',
		begin: async ({fs}) => {
			await fs.remove(dir);
		},
		adapt: async ({config, fs, dev, log, args}) => {
			const {map_input_options, map_output_options, map_watch_options} = args;

			const timings = new Timings(); // TODO probably move to task context

			const build_config = config.builds.find((b) => b.name === build_name);
			if (!build_config) {
				throw Error(`Unknown build config: ${build_name}`);
			}

			const files = to_input_files(build_config.input);

			const timing_to_bundle_with_rollup = timings.start('bundle with rollup');
			if (type === 'bundled') {
				if (type !== 'bundled') throw Error();
				// TODO use `filters` to select the others..right?
				if (!files.length) {
					log.trace('no input files in', print_build_config_label(build_config));
					return;
				}
				const input = files.map((source_id) => to_import_id(source_id, dev, build_config.name));
				const output_dir = dir;
				log.info('bundling', print_build_config_label(build_config), output_dir, files);
				if (!cjs && !esm) {
					throw Error(`Build must have either cjs or esm or both: ${build_name}`);
				}
				if (cjs) {
					await runRollup({
						dev,
						sourcemap: config.sourcemap,
						input,
						output_dir,
						map_input_options,
						map_output_options: (o, b) => ({
							...(map_output_options ? map_output_options(o, b) : o),
							format: 'commonjs',
						}),
						map_watch_options,
					});
					await fs.move(`${dir}/index.js`, `${dir}/index.cjs`);
				}
				if (esm) {
					await runRollup({
						dev,
						sourcemap: config.sourcemap,
						input,
						output_dir,
						map_input_options,
						map_output_options,
						map_watch_options,
					});
				}
			}
			timing_to_bundle_with_rollup();

			const timing_to_copy_dist = timings.start('copy builds to dist');
			const filter = type === 'bundled' ? bundled_dist_filter : undefined;
			await copy_dist(fs, build_config, dev, dir, log, filter, pack);
			timing_to_copy_dist();

			// If the output is treated as a package, it needs some special handling to get it ready.
			if (pack) {
				// copy files from the project root to the dist, but don't overwrite anything in the build
				await Promise.all(
					(await fs.read_dir('.')).map((path): void | Promise<void> => {
						const filename = path.toLowerCase();
						if (PACKAGE_FILES.has(filename) || OTHER_PACKAGE_FILES.has(filename)) {
							return fs.copy(path, `${dir}/${path}`, {overwrite: false});
						}
					}),
				);

				// copy src
				await fs.copy(paths.source, `${dir}/${SOURCE_DIRNAME}`);

				// update package.json with computed values
				const pkg_path = `${dir}/package.json`;
				const pkg = JSON.parse(await fs.read_file(pkg_path, 'utf8'));

				// add the "files" key to package.json
				const pkg_files = new Set(pkg.files || []);
				const dir_paths = await fs.read_dir(dir);
				for (const path of dir_paths) {
					if (
						!PACKAGE_FILES.has(path.toLowerCase()) &&
						!path.endsWith(TS_TYPE_EXTENSION) &&
						!path.endsWith(TS_TYPEMAP_EXTENSION)
					) {
						pkg_files.add(path);
					}
				}
				pkg.files = Array.from(pkg_files);

				// add the "exports" key to package.json
				const pkg_exports: Record<string, string> = {
					'.': pkg.main,
					'./package.json': './package.json',
				};
				for (const source_id of files) {
					const path = `./${to_build_extension(source_id_to_base_path(source_id))}`;
					pkg_exports[path] = path;
				}
				pkg.exports = pkg_exports;

				// write the new package.json
				await fs.write_file(pkg_path, JSON.stringify(pkg, null, 2), 'utf8');
			}

			// `npm link` if configured
			if (link) {
				const timing_to_npm_link = timings.start('npm link');
				const chmod_result = await spawn_process('chmod', ['+x', link]);
				if (!chmod_result.ok) log.error(`CLI chmod failed with code ${chmod_result.code}`);
				log.info(`linking`);
				const link_result = await spawn_process('npm', ['link']);
				if (!link_result.ok) {
					throw new Task_Error(`Failed to link. ${print_spawn_result(link_result)}`);
				}
				timing_to_npm_link();
			}

			print_timings(timings, log);
		},
	};
};

const bundled_dist_filter = (id: string, stats: Path_Stats): boolean =>
	stats.isDirectory() ? true : id.endsWith(TS_TYPE_EXTENSION) || id.endsWith(TS_TYPEMAP_EXTENSION);

// these can be any case and optionally end with `.md`
const to_possible_file_names = (paths: string[]): string[] =>
	paths.flatMap((path) => {
		const lower = path.toLowerCase();
		return [lower, `${lower}.md`];
	});

// these are the files npm includes by default; unlike npm, the only extension we support is `.md`
const PACKAGE_FILES = new Set(
	['package.json'].concat(
		to_possible_file_names([
			'README',
			'CHANGES',
			'CHANGELOG',
			'HISTORY',
			'LICENSE',
			'LICENCE',
			'NOTICE',
		]),
	),
);
const OTHER_PACKAGE_FILES = new Set(to_possible_file_names(['GOVERNANCE']));
