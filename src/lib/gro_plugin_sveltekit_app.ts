import {spawn_process, type Spawned_Process} from '@grogarden/util/process.js';
import {cp, mkdir, rm, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';

import type {Plugin, Plugin_Context} from './plugin.js';
import {print_command_args, serialize_args, to_forwarded_args} from './args.js';
import {exists} from './fs.js';
import {serialize_package_json, type Map_Package_Json, load_package_json} from './package_json.js';
import {init_sveltekit_config} from './sveltekit_config.js';
import {Task_Error} from './task.js';
import {spawn_cli} from './cli.js';
import {type Map_Src_Json, serialize_src_json, create_src_json} from './src_json.js';
import {DEFAULT_EXPORTS_EXCLUDER} from './config.js';
import {SVELTEKIT_CONFIG_FILENAME} from './paths.js';

export const has_sveltekit_app = (): Promise<boolean> => exists(SVELTEKIT_CONFIG_FILENAME);

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
	 * Filter what's copied from `src/` to `.well-known/src/`.
	 */
	filter_well_known_src?: (source: string, destination: string) => boolean | Promise<boolean>;
}

export type Host_Target = 'github_pages' | 'static' | 'node';

export const gro_plugin_sveltekit_app = ({
	host_target = 'github_pages',
	well_known_package_json,
	well_known_src_json,
	filter_well_known_src = (source) => !DEFAULT_EXPORTS_EXCLUDER.test(source),
}: Options = {}): Plugin<Plugin_Context> => {
	let sveltekit_process: Spawned_Process | null = null;
	return {
		name: 'gro_plugin_sveltekit_app',
		setup: async ({dev, watch, log}) => {
			if (dev) {
				// `vite dev` in development mode
				if (watch) {
					const serialized_args = ['vite', 'dev', ...serialize_args(to_forwarded_args('vite'))];
					log.info(print_command_args(serialized_args));
					sveltekit_process = spawn_process('npx', serialized_args);
				} else {
					log.debug(
						`the SvelteKit frontend plugin is loaded but will not output anything` +
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
				const {assets_path} = await init_sveltekit_config(); // TODO probably put in plugin context
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
					serialized_src_json
						? await copy_temporarily('src', assets_path, '.well-known', filter_well_known_src)
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
					const serialized_args = ['build', ...serialize_args(to_forwarded_args('vite'))];
					log.info(print_command_args(['vite'].concat(serialized_args)));
					const spawned = await spawn_cli('vite', serialized_args); // TODO call with the gro helper instead of npx?
					if (!spawned?.ok) {
						throw new Task_Error('vite build failed with exit code ' + spawned?.code);
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
	filter?: (source: string, destination: string) => boolean | Promise<boolean>,
): Promise<Cleanup> => {
	const path = join(dest_dir, dest_base_dir, source_path);
	const dir = dirname(path);

	const dir_already_exists = await exists(dir);
	let root_created_dir: string | undefined;
	if (!dir_already_exists) {
		root_created_dir = await to_root_dir_that_doesnt_exist(dir);
		if (!root_created_dir) throw Error();
		await mkdir(dir, {recursive: true});
	}

	const path_already_exists = await exists(path);
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

	const dir_already_exists = await exists(dir);
	let root_created_dir: string | undefined;
	if (!dir_already_exists) {
		root_created_dir = await to_root_dir_that_doesnt_exist(dir);
		if (!root_created_dir) throw Error();
		await mkdir(dir, {recursive: true});
	}

	const path_already_exists = await exists(path);
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
		// eslint-disable-next-line no-await-in-loop
		if (await exists(d)) {
			return prev;
		}
		prev = d;
	} while ((d = dirname(d)));
	throw Error('no dirs exist for ' + dir);
};
