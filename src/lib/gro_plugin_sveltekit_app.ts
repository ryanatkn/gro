import type {Spawned_Process} from '@ryanatkn/belt/process.js';
import {cp, mkdir, rm, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {existsSync} from 'node:fs';

import type {Plugin, Plugin_Context} from './plugin.js';
import {serialize_args, to_forwarded_args} from './args.js';
import {serialize_package_json, type Map_Package_Json, load_package_json} from './package_json.js';
import {Task_Error} from './task.js';
import {find_cli, spawn_cli, spawn_cli_process} from './cli.js';
import {type Map_Src_Json, serialize_src_json, create_src_json} from './src_json.js';
import {DEFAULT_EXPORTS_EXCLUDER} from './config.js';
import {sveltekit_config_global} from './sveltekit_config_global.js';
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

export interface Copy_File_Filter {
	(file_path: string): boolean | Promise<boolean>;
}

export const gro_plugin_sveltekit_app = ({
	host_target = 'github_pages',
	well_known_package_json,
	well_known_src_json,
	well_known_src_files,
	vite_cli = VITE_CLI,
}: Options = {}): Plugin<Plugin_Context> => {
	let sveltekit_process: Spawned_Process | undefined = undefined;
	return {
		name: 'gro_plugin_sveltekit_app',
		setup: async ({dev, watch, log}) => {
			const found_vite_cli = find_cli(vite_cli);
			if (!found_vite_cli)
				throw new Error(`Failed to find Vite CLI \`${vite_cli}\`, do you need to run \`npm i\`?`);
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
				const package_json = await load_package_json(); // TODO put in plugin context? same with sveltekit config?
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
				const final_package_json = mapped_package_json || package_json;
				const src_json = await create_src_json(final_package_json);
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
				const {assets_path} = sveltekit_config_global;
				const cleanups: Cleanup[] = [
					serialized_package_json
						? await create_temporarily(
								join(assets_path, '.well-known/package.json'),
								serialized_package_json,
							)
						: null!,
					serialized_src_json
						? await create_temporarily(
								join(assets_path, '.well-known/src.json'),
								serialized_src_json,
							)
						: null!,
					serialized_src_json && well_known_src_files
						? await copy_temporarily(
								SOURCE_DIRNAME,
								assets_path,
								'.well-known',
								well_known_src_files === true
									? (file_path) => !DEFAULT_EXPORTS_EXCLUDER.test(file_path)
									: well_known_src_files,
							)
						: null!,
					/**
					 * GitHub pages processes everything with Jekyll by default,
					 * breaking things like files and dirs prefixed with an underscore.
					 * This adds a `.nojekyll` file to the root of the output
					 * to tell GitHub Pages to treat the outputs as plain static files.
					 */
					host_target === 'github_pages'
						? await create_temporarily(join(assets_path, '.nojekyll'), '')
						: null!,
				].filter(Boolean);
				const cleanup = () => Promise.all(cleanups.map((c) => c()));
				try {
					const serialized_args = ['build', ...serialize_args(to_forwarded_args(vite_cli))];
					const spawned = await spawn_cli(found_vite_cli, serialized_args, log);
					if (!spawned?.ok) {
						throw new Task_Error(`${vite_cli} build failed with exit code ${spawned?.code}`);
					}
				} catch (err) {
					await cleanup();
					throw err;
				}
				await cleanup();
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

interface Cleanup {
	(): Promise<void>;
}

// TODO probably extract these, and create a common helper or merge them

const copy_temporarily = async (
	source_path: string,
	dest_dir: string,
	dest_base_dir = '',
	filter?: Copy_File_Filter,
): Promise<Cleanup> => {
	const path = join(dest_dir, dest_base_dir, source_path);
	const dir = dirname(path);

	const dir_already_exists = existsSync(dir);
	let root_created_dir: string | undefined;
	if (!dir_already_exists) {
		root_created_dir = await to_root_dir_that_doesnt_exist(dir);
		if (!root_created_dir) throw Error();
		await mkdir(dir, {recursive: true});
	}

	const path_already_exists = existsSync(path);
	if (!path_already_exists) {
		await cp(source_path, path, {recursive: true, filter});
	}

	return async () => {
		if (!dir_already_exists) {
			if (!root_created_dir) throw Error();
			await rm(root_created_dir, {recursive: true});
		} else if (!path_already_exists) {
			await rm(path, {recursive: true});
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
const create_temporarily = async (path: string, contents: string): Promise<Cleanup> => {
	const dir = dirname(path);

	const dir_already_exists = existsSync(dir);
	let root_created_dir: string | undefined;
	if (!dir_already_exists) {
		root_created_dir = await to_root_dir_that_doesnt_exist(dir);
		if (!root_created_dir) throw Error();
		await mkdir(dir, {recursive: true});
	}

	const path_already_exists = existsSync(path);
	if (!path_already_exists) {
		await writeFile(path, contents, 'utf8');
	}

	return async () => {
		if (!dir_already_exists) {
			if (!root_created_dir) throw Error();
			await rm(root_created_dir, {recursive: true});
		} else if (!path_already_exists) {
			await rm(path);
		}
	};
};

/**
 * Niche and probably needs refactoring,
 * for `/a/b/DOESNT_EXIST/NOR_THIS/ETC` returns `/a/b/DOESNT_EXIST`
 * where `/a/b` does exist on the filesystem and `DOESNT_EXIST` is not one of its subdirectories.
 */
const to_root_dir_that_doesnt_exist = async (dir: string): Promise<string | undefined> => {
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
