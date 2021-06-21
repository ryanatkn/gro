import {Timings} from '@feltcoop/felt/util/time.js';
import {print_timings} from '@feltcoop/felt/util/print.js';
import {print_spawn_result, spawn_process} from '@feltcoop/felt/util/process.js';
import {EMPTY_OBJECT} from '@feltcoop/felt/util/object.js';
import {strip_trailing_slash} from '@feltcoop/felt/util/path.js';

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
import {run_rollup} from '../build/rollup.js';
import type {Path_Stats} from '../fs/path_data.js';
import type {Task_Args as Build_Task_Args} from '../build.task.js';
import {load_package_json} from '../utils/package_json.js';

// TODO maybe add a `files` option to explicitly include source files,
// and fall back to inferring from the build config
// (it should probably accept the normal include/exclude filters from @rollup/pluginutils)

export interface Options {
	build_name: Build_Name; // defaults to 'library'
	dir: string; // defaults to `dist/${build_name}`
	type: 'unbundled' | 'bundled'; // defaults to 'unbundled'
	// TODO currently these options are only available for 'bundled'
	esm: boolean; // defaults to true
	cjs: boolean; // defaults to true
	pack: boolean; // treat the dist as a package to be published - defaults to true
}

export interface Adapter_Args extends Build_Task_Args {}

export const create_adapter = ({
	build_name = NODE_LIBRARY_BUILD_NAME,
	dir = `${paths.dist}${build_name}`,
	type = 'unbundled',
	esm = true,
	cjs = true,
	pack = true,
}: Partial<Options> = EMPTY_OBJECT): Adapter<Adapter_Args> => {
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
					await run_rollup({
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
					await run_rollup({
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

			const pkg = await load_package_json(fs);

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
					'.': pkg.main!,
					'./package.json': './package.json',
				};
				for (const source_id of files) {
					const path = `./${to_build_extension(source_id_to_base_path(source_id))}`;
					pkg_exports[path] = path;
				}
				pkg.exports = pkg_exports;

				// write the new package.json
				await fs.write_file(`${dir}/package.json`, JSON.stringify(pkg, null, 2), 'utf8');
			}

			// `npm link`
			if (pkg.bin) {
				const timing_to_npm_link = timings.start('npm link');
				await Promise.all(
					Object.values(pkg.bin).map(async (bin_path) => {
						const chmod_result = await spawn_process('chmod', ['+x', bin_path]);
						if (!chmod_result.ok) log.error(`CLI chmod failed with code ${chmod_result.code}`);
					}),
				);
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
const to_possible_filenames = (paths: string[]): string[] =>
	paths.flatMap((path) => {
		const lower = path.toLowerCase();
		return [lower, `${lower}.md`];
	});

// these are the files npm includes by default; unlike npm, the only extension we support is `.md`
const PACKAGE_FILES = new Set(
	['package.json'].concat(
		to_possible_filenames([
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
const OTHER_PACKAGE_FILES = new Set(to_possible_filenames(['GOVERNANCE']));
