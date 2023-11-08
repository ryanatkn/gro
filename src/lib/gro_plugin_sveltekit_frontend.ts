import {spawn_process, type Spawned_Process} from '@grogarden/util/process.js';
import {mkdir, rm, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import type {Config as SveltekitConfig} from '@sveltejs/kit';

import type {Plugin, Plugin_Context} from './plugin.js';
import {print_command_args, serialize_args, to_forwarded_args} from './args.js';
import {exists} from './exists.js';
import {
	serialize_package_json,
	type Map_Package_Json,
	load_mapped_package_json,
} from './package_json.js';
import {init_sveltekit_config} from './sveltekit_config.js';
import {Task_Error} from './task.js';
import {spawn_cli} from './cli.js';

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
	 * Optional SvelteKit config, defaults to `svelte.config.js`.
	 */
	sveltekit_config?: string | SveltekitConfig;
}

export type Host_Target = 'github_pages' | 'static' | 'node';

export const plugin = ({
	host_target = 'github_pages',
	well_known_package_json,
	sveltekit_config,
}: Options = {}): Plugin<Plugin_Context> => {
	let sveltekit_process: Spawned_Process | null = null;
	return {
		name: 'gro_plugin_sveltekit_frontend',
		setup: async ({dev, watch, log}) => {
			const {assets_path} = await init_sveltekit_config(sveltekit_config);

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

				const package_json = await load_mapped_package_json();
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

				// copy files to `static` before building, in such a way
				// that's non-destructive to existing files and dirs and easy to clean up
				// TODO this strategy means the files aren't available during development -- maybe a Vite middleware is best? what if this plugin added its plugin to your `vite.config.ts`?
				const cleanups: Cleanup[] = [
					serialized_package_json
						? await create_temporarily(
								join(assets_path, '.well-known/package.json'),
								serialized_package_json,
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

// TODO for `src` and `src.json`
// const copy_temporarily = async (
// 	source_path: string,
// 	dest_dir: string,
// 	dest_base_dir = '',
// ): Promise<Cleanup> => {
// 	const path = join(dest_dir, dest_base_dir, source_path);
// 	const dir = dirname(path);

// 	const dir_already_exists = await exists(dir);
// 	if (!dir_already_exists) {
// 		await mkdir(dir, {recursive: true});
// 	}

// 	const path_already_exists = await exists(path);
// 	if (!path_already_exists) {
// 		await cp(source_path, path, {recursive: true});
// 	}
// 	return async () => {
// 		if (!dir_already_exists) {
// 			await rm(dir, {recursive: true});
// 		} else if (!path_already_exists) {
// 			await rm(path, {recursive: true});
// 		}
// 	};
// };

/**
 * Creates a file at `path` with `contents` if it doesn't already exist,
 * and returns a function that deletes the file and any created directories.
 * @param path
 * @param contents
 * @returns cleanup function that deletes the file and any created dirs
 */
const create_temporarily = async (path: string, contents: string): Promise<Cleanup> => {
	// TODO handle more than 1 hardcoded depth
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
 * for `/a/b/DOESNT_EXIST/NOR_THIS/ETC` returns `/a/b/DOESNT_EXIST`.
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
	throw Error();
};
