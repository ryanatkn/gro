import {print_spawn_result, spawn} from '@feltcoop/felt/util/process.js';
import {EMPTY_OBJECT} from '@feltcoop/felt/util/object.js';
import {strip_trailing_slash} from '@feltcoop/felt/util/path.js';
import {strip_start} from '@feltcoop/felt/util/string.js';

import type {Adapter} from './adapter.js';
import {Task_Error} from '../task/task.js';
import {copy_dist} from './utils.js';
import {
	paths,
	source_id_to_base_path,
	SOURCE_DIRNAME,
	to_build_extension,
	to_import_id,
	TS_TYPEMAP_EXTENSION,
	TS_TYPE_EXTENSION,
	DIST_DIRNAME,
} from '../paths.js';
import {NODE_LIBRARY_BUILD_NAME} from '../build/default_build_config.js';
import type {Build_Name} from '../build/build_config.js';
import {print_build_config_label, to_input_files} from '../build/build_config.js';
import {run_rollup} from '../build/rollup.js';
import type {Path_Stats} from '../fs/path_data.js';
import type {Package_Json} from '../utils/package_json.js';

const name = '@feltcoop/gro_adapter_node_library';

// In normal circumstances, this adapter expects to handle
// only code scoped to `src/lib`, following SvelteKit conventions.
// It also supports Gro's current usecase that doesn't put anything under `lib/`,
// but that functionality may be removed to have one hardcoded happy path.
// In the normal case, the final package is flattened to the root directory,
// so `src/lib/index.ts` becomes `index.ts`.
// Import paths are *not* remapped by the adapter,
// but Gro's build process does map `$lib/` and `src/` to relative paths.
// This means all library modules must be under `src/lib` to work without additional transformation.
const LIBRARY_DIR = 'lib/';
// This function converts the build config's source file ids to the flattened base paths:
const source_id_to_library_base_path = (source_id: string, library_rebase_path: string): string => {
	const base_path = source_id_to_base_path(source_id);
	if (!base_path.startsWith(library_rebase_path)) {
		throw Error(
			`Source file does not start with library_rebase_path ${library_rebase_path}: ${base_path}`,
		);
	}
	return strip_start(to_build_extension(base_path, false), library_rebase_path);
};

// TODO maybe add a `files` option to explicitly include source files,
// and fall back to inferring from the build config
// (it should probably accept the normal include/exclude filters from @rollup/pluginutils)

export interface Options {
	build_name: Build_Name; // defaults to 'library'
	dir: string; // defaults to `dist/${build_name}`
	package_json: string; // defaults to 'package.json'
	pack: boolean; // TODO temp hack for Gro's build -- treat the dist as a package to be published - defaults to true
	library_rebase_path: string; // defaults to 'lib/', pass '' to avoid remapping -- TODO do we want to remove this after Gro follows SvelteKit conventions?
	bundle: boolean; // defaults to `false`
	// TODO currently these options are only available for 'bundled'
	esm: boolean; // defaults to true
	cjs: boolean; // defaults to true
}

export const create_adapter = ({
	build_name = NODE_LIBRARY_BUILD_NAME,
	dir = `${DIST_DIRNAME}/${build_name}`,
	library_rebase_path = LIBRARY_DIR,
	package_json = 'package.json',
	pack = true,
	bundle = false,
	esm = true,
	cjs = true,
}: Partial<Options> = EMPTY_OBJECT): Adapter => {
	dir = strip_trailing_slash(dir);
	return {
		name,
		adapt: async ({config, fs, dev, log, args, timings}) => {
			await fs.remove(dir);

			const {map_input_options, map_output_options, map_watch_options} = args;

			const build_config = config.builds.find((b) => b.name === build_name);
			if (!build_config) {
				throw Error(`Unknown build config: ${build_name}`);
			}

			const files = to_input_files(build_config.input);

			if (bundle) {
				const timing_to_bundle_with_rollup = timings.start('bundle with rollup');
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
						fs,
						dev,
						sourcemap: config.sourcemap,
						input,
						output_dir,
						map_input_options,
						map_output_options: (r, o) => ({
							...(map_output_options ? map_output_options(r, o) : r),
							format: 'commonjs',
						}),
						map_watch_options,
					});
					await fs.move(`${dir}/index.js`, `${dir}/index.cjs`);
				}
				if (esm) {
					await run_rollup({
						fs,
						dev,
						sourcemap: config.sourcemap,
						input,
						output_dir,
						map_input_options,
						map_output_options,
						map_watch_options,
					});
				}
				timing_to_bundle_with_rollup();
			}

			const timing_to_copy_dist = timings.start('copy build to dist');
			const filter = bundle ? bundled_dist_filter : undefined;
			await copy_dist(fs, build_config, dev, dir, log, filter, pack, library_rebase_path);
			timing_to_copy_dist();

			let pkg: Package_Json;
			try {
				pkg = JSON.parse(await fs.read_file(package_json, 'utf8'));
			} catch (err) {
				throw Error(`Adapter ${name} failed to load package_json at path ${package_json}: ${err}`);
			}

			// If the output is treated as a package, it needs some special handling to get it ready.
			if (pack) {
				const timing_to_pack_dist = timings.start('pack dist');
				// copy files from the project root to the dist, but don't overwrite anything in the build
				await Promise.all(
					(
						await fs.read_dir('.')
					).map((path): void | Promise<void> => {
						if (PACKAGE_FILES.has(path) || OTHER_PACKAGE_FILES.has(path)) {
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
					if (!PACKAGE_FILES.has(path)) {
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
					const path = `./${source_id_to_library_base_path(source_id, library_rebase_path)}`;
					pkg_exports[path] = path;
				}
				pkg.exports = pkg_exports;

				// write the new package.json
				await fs.write_file(`${dir}/package.json`, JSON.stringify(pkg, null, 2), 'utf8');

				timing_to_pack_dist();
			}

			// `npm link`
			if (pkg.bin) {
				const timing_to_npm_link = timings.start('npm link');
				await Promise.all(
					Object.values(pkg.bin).map(async (bin_path) => {
						const chmod_result = await spawn('chmod', ['+x', bin_path]);
						if (!chmod_result.ok) log.error(`CLI chmod failed with code ${chmod_result.code}`);
					}),
				);
				log.info(`linking`);
				const link_result = await spawn('npm', ['link']);
				if (!link_result.ok) {
					throw new Task_Error(`Failed to link. ${print_spawn_result(link_result)}`);
				}
				timing_to_npm_link();
			}
		},
	};
};

const bundled_dist_filter = (id: string, stats: Path_Stats): boolean =>
	stats.isDirectory() ? true : id.endsWith(TS_TYPE_EXTENSION) || id.endsWith(TS_TYPEMAP_EXTENSION);

// these can be any case and optionally end with `.md`
const to_possible_filenames = (paths: string[]): string[] =>
	paths.flatMap((path) => {
		const lower = path.toLowerCase();
		const upper = path.toUpperCase();
		return [lower, `${lower}.md`, upper, `${upper}.md`];
	});

// these are a subset of the files npm includes by default --
// unlike npm, the only extension we support is `.md`
const PACKAGE_FILES = new Set(
	['package.json'].concat(to_possible_filenames(['README', 'LICENSE'])),
);
const OTHER_PACKAGE_FILES = new Set(to_possible_filenames(['CHANGELOG', 'GOVERNANCE']));
