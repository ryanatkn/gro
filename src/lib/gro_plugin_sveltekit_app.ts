import type {Spawned_Process} from '@ryanatkn/belt/process.js';
import {cpSync, mkdirSync, rmSync, writeFileSync, existsSync} from 'node:fs';
import {dirname, join} from 'node:path';

import type {Plugin} from './plugin.js';
import {serialize_args, to_forwarded_args} from './args.js';
import {serialize_package_json, type Map_Package_Json, load_package_json} from './package_json.js';
import {Task_Error} from './task.js';
import {find_cli, spawn_cli, spawn_cli_process} from './cli.js';
import {type Map_Src_Json, serialize_src_json, create_src_json} from './src_json.js';
import {EXPORTS_EXCLUDER_DEFAULT} from './gro_config.js';
import {default_sveltekit_config} from './sveltekit_config.js';
import {SOURCE_DIRNAME} from './path_constants.js';
import {VITE_CLI} from './sveltekit_helpers.js';

export interface Options {
	/**
	 * Used for finalizing a SvelteKit build like adding a `.nojekyll` file for GitHub Pages.
	 * @default 'github_pages'
	 */
	host_target?: Host_Target;

	/**
	 * If truthy, adds `/.well-known/package.json` to the static output.
	 * If a function, maps the value.
	 */
	well_known_package_json?: boolean | Map_Package_Json;

	/**
	 * If truthy, adds `/.well-known/src.json` and `/.well-known/src/` to the static output.
	 * If a function, maps the value.
	 */
	well_known_src_json?: boolean | Map_Src_Json;

	/**
	 * If truthy, copies `src/` to `/.well-known/src/` to the static output.
	 * Pass a function to customize which files get copied.
	 */
	well_known_src_files?: boolean | Copy_File_Filter;
	/**
	 * The Vite CLI to use.
	 */
	vite_cli?: string;
}

export type Host_Target = 'github_pages' | 'static' | 'node';

export type Copy_File_Filter = (file_path: string) => boolean;

export const gro_plugin_sveltekit_app = ({
	host_target = 'github_pages',
	well_known_package_json,
	well_known_src_json,
	well_known_src_files,
	vite_cli = VITE_CLI,
}: Options = {}): Plugin => {
	let sveltekit_process: Spawned_Process | undefined = undefined;
	return {
		name: 'gro_plugin_sveltekit_app',
		setup: async ({dev, watch, log, config}) => {
			const found_vite_cli = find_cli(vite_cli);
			if (!found_vite_cli)
				throw new Error(
					`Failed to find Vite CLI \`${vite_cli}\`, do you need to run \`${config.pm_cli} i\`?`,
				);
			if (dev) {
				// `vite dev` in development mode
				if (watch) {
					const serialized_args = ['dev', ...serialize_args(to_forwarded_args(vite_cli))];
					sveltekit_process = spawn_cli_process(found_vite_cli, serialized_args, log);
				} else {
					log.debug(
						`the SvelteKit app plugin is loaded but will not output anything` +
							' because `dev` is true and `watch` is false',
					);
				}
			} else {
				// `vite build` in production mode

				// `.well-known/package.json`
				const package_json = load_package_json(); // TODO put in plugin context? same with sveltekit config?
				if (well_known_package_json === undefined) {
					well_known_package_json = package_json.public; // eslint-disable-line no-param-reassign
				}
				const mapped_package_json = !well_known_package_json
					? null
					: well_known_package_json === true
						? package_json
						: await well_known_package_json(package_json);
				const serialized_package_json =
					mapped_package_json && serialize_package_json(mapped_package_json);

				// `.well-known/src.json` and `.well-known/src/`
				const final_package_json = mapped_package_json ?? package_json;
				const src_json = create_src_json(final_package_json);
				if (well_known_src_json === undefined) {
					well_known_src_json = final_package_json.public; // eslint-disable-line no-param-reassign
				}
				const mapped_src_json = !well_known_src_json
					? null
					: well_known_src_json === true
						? src_json
						: await well_known_src_json(src_json);
				const serialized_src_json = mapped_src_json && serialize_src_json(mapped_src_json);

				// TODO this strategy means the files aren't available during development --
				// maybe a Vite middleware is best? what if this plugin added its plugin to your `vite.config.ts`?

				// copy files to `static` before building, in such a way
				// that's non-destructive to existing files and dirs and easy to clean up
				const {assets_path} = default_sveltekit_config;
				const cleanups: Cleanup[] = [
					serialized_package_json
						? create_temporarily(
								join(assets_path, '.well-known/package.json'),
								serialized_package_json,
							)
						: null,
					serialized_src_json
						? create_temporarily(join(assets_path, '.well-known/src.json'), serialized_src_json)
						: null,
					serialized_src_json && well_known_src_files
						? copy_temporarily(
								SOURCE_DIRNAME,
								assets_path,
								'.well-known',
								well_known_src_files === true
									? (file_path) => !EXPORTS_EXCLUDER_DEFAULT.test(file_path)
									: well_known_src_files,
							)
						: null,
					/**
					 * GitHub pages processes everything with Jekyll by default,
					 * breaking things like files and dirs prefixed with an underscore.
					 * This adds a `.nojekyll` file to the root of the output
					 * to tell GitHub Pages to treat the outputs as plain static files.
					 */
					host_target === 'github_pages'
						? create_temporarily(join(assets_path, '.nojekyll'), '')
						: null,
				].filter((v) => v != null);
				const cleanup = () => {
					for (const c of cleanups) c();
				};
				try {
					const serialized_args = ['build', ...serialize_args(to_forwarded_args(vite_cli))];
					const spawned = await spawn_cli(found_vite_cli, serialized_args, log);
					if (!spawned?.ok) {
						throw new Task_Error(`${vite_cli} build failed with exit code ${spawned?.code}`);
					}
				} catch (err) {
					cleanup();
					throw err;
				}
				cleanup();
			}
		},
		teardown: async () => {
			if (sveltekit_process) {
				sveltekit_process.child.kill();
				await sveltekit_process.closed;
			}
		},
	};
};

type Cleanup = () => void;

// TODO probably extract these, and create a common helper or merge them

const copy_temporarily = (
	source_path: string,
	dest_dir: string,
	dest_base_dir = '',
	filter?: Copy_File_Filter,
): Cleanup => {
	const path = join(dest_dir, dest_base_dir, source_path);
	const dir = dirname(path);

	const dir_already_exists = existsSync(dir);
	let root_created_dir: string | undefined;
	if (!dir_already_exists) {
		root_created_dir = to_root_dir_that_doesnt_exist(dir);
		if (!root_created_dir) throw Error();
		mkdirSync(dir, {recursive: true});
	}

	const path_already_exists = existsSync(path);
	if (!path_already_exists) {
		cpSync(source_path, path, {recursive: true, filter});
	}

	return () => {
		if (!dir_already_exists) {
			if (!root_created_dir) throw Error();
			if (existsSync(root_created_dir)) {
				rmSync(root_created_dir, {recursive: true});
			}
		} else if (!path_already_exists) {
			if (existsSync(path)) {
				rmSync(path, {recursive: true});
			}
		}
	};
};

/**
 * Creates a file at `path` with `contents` if it doesn't already exist,
 * and returns a function that deletes the file and any created directories.
 * @param path
 * @param contents
 * @returns cleanup function that deletes the file and any created dirs
 */
const create_temporarily = (path: string, contents: string): Cleanup => {
	const dir = dirname(path);

	const dir_already_exists = existsSync(dir);
	let root_created_dir: string | undefined;
	if (!dir_already_exists) {
		root_created_dir = to_root_dir_that_doesnt_exist(dir);
		if (!root_created_dir) throw Error();
		mkdirSync(dir, {recursive: true});
	}

	const path_already_exists = existsSync(path);
	if (!path_already_exists) {
		writeFileSync(path, contents, 'utf8');
	}

	return () => {
		if (!dir_already_exists) {
			if (!root_created_dir) throw Error();
			if (existsSync(root_created_dir)) {
				rmSync(root_created_dir, {recursive: true});
			}
		} else if (!path_already_exists) {
			if (existsSync(path)) {
				rmSync(path);
			}
		}
	};
};

/**
 * Niche and probably needs refactoring,
 * for `/a/b/DOESNT_EXIST/NOR_THIS/ETC` returns `/a/b/DOESNT_EXIST`
 * where `/a/b` does exist on the filesystem and `DOESNT_EXIST` is not one of its subdirectories.
 */
const to_root_dir_that_doesnt_exist = (dir: string): string | undefined => {
	let prev: string | undefined;
	let d = dir;
	do {
		if (existsSync(d)) {
			return prev;
		}
		prev = d;
	} while ((d = dirname(d)));
	throw Error('no dirs exist for ' + dir);
};
