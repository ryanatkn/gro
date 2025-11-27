import type {SpawnedProcess} from '@ryanatkn/belt/process.js';
import {cp, mkdir, rm, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fs_exists} from '@ryanatkn/belt/fs.js';

import type {Plugin} from './plugin.ts';
import {serialize_args, to_forwarded_args} from './args.ts';
import {serialize_package_json, type PackageJsonMapper, load_package_json} from './package_json.ts';
import {TaskError} from './task.ts';
import {find_cli, spawn_cli, spawn_cli_process} from './cli.ts';
import {type SourceJsonMapper, source_json_serialize, source_json_create} from './source_json.ts';
import {EXPORTS_EXCLUDER_DEFAULT} from './gro_config.ts';
import {default_svelte_config} from './svelte_config.ts';
import {SOURCE_DIRNAME, VITE_CLI} from './constants.ts';

export interface GroPluginSveltekitAppOptions {
	/**
	 * Used for finalizing a SvelteKit build like adding a `.nojekyll` file for GitHub Pages.
	 * @default 'github_pages'
	 */
	host_target?: HostTarget;

	/**
	 * If truthy, adds `/.well-known/package.json` to the static output.
	 * If a function, maps the value.
	 */
	well_known_package_json?: boolean | PackageJsonMapper;

	/**
	 * If truthy, adds `/.well-known/source.json` and `/.well-known/src/` to the static output.
	 * If a function, maps the value.
	 */
	well_known_source_json?: boolean | SourceJsonMapper;

	/**
	 * If truthy, copies `src/` to `/.well-known/src/` to the static output.
	 * Pass a function to customize which files get copied.
	 */
	well_known_src_files?: boolean | CopyFileFilter;
	/**
	 * The Vite CLI to use.
	 */
	vite_cli?: string;
}

export type HostTarget = 'github_pages' | 'static' | 'node';

export type CopyFileFilter = (file_path: string) => boolean;

export const gro_plugin_sveltekit_app = ({
	host_target = 'github_pages',
	well_known_package_json,
	well_known_source_json,
	well_known_src_files,
	vite_cli = VITE_CLI,
}: GroPluginSveltekitAppOptions = {}): Plugin => {
	let sveltekit_process: SpawnedProcess | undefined = undefined;
	return {
		name: 'gro_plugin_sveltekit_app',
		setup: async ({dev, watch, log, config}) => {
			const found_vite_cli = find_cli(vite_cli);
			if (!found_vite_cli)
				throw Error(
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

				// `.well-known/source.json` and `.well-known/src/`
				const final_package_json = mapped_package_json ?? package_json;
				const source_json = await source_json_create(final_package_json, undefined, log);
				if (well_known_source_json === undefined) {
					well_known_source_json = final_package_json.public; // eslint-disable-line no-param-reassign
				}
				const mapped_source_json = !well_known_source_json
					? null
					: well_known_source_json === true
						? source_json
						: await well_known_source_json(source_json);
				const serialized_source_json =
					mapped_source_json && source_json_serialize(mapped_source_json);

				// TODO this strategy means the files aren't available during development --
				// maybe a Vite middleware is best? what if this plugin added its plugin to your `vite.config.ts`?

				// copy files to `static` before building, in such a way
				// that's non-destructive to existing files and dirs and easy to clean up
				const {assets_path} = default_svelte_config;
				const cleanup_promises = [
					serialized_package_json
						? create_temporarily(
								join(assets_path, '.well-known/package.json'),
								serialized_package_json,
							)
						: null,
					serialized_source_json
						? create_temporarily(
								join(assets_path, '.well-known/source.json'),
								serialized_source_json,
							)
						: null,
					serialized_source_json && well_known_src_files
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
				].filter((v): v is Promise<AsyncCleanup> => v != null);
				const cleanups = await Promise.all(cleanup_promises);
				const cleanup = async () => {
					// eslint-disable-next-line no-await-in-loop
					for (const c of cleanups) await c();
				};
				try {
					const serialized_args = ['build', ...serialize_args(to_forwarded_args(vite_cli))];
					const spawned = await spawn_cli(found_vite_cli, serialized_args, log);
					if (!spawned?.ok) {
						throw new TaskError(`${vite_cli} build failed with exit code ${spawned?.code}`);
					}
				} catch (error) {
					await cleanup();
					throw error;
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

type AsyncCleanup = () => Promise<void>;

// TODO probably extract these, and create a common helper or merge them

const copy_temporarily = async (
	source_path: string,
	dest_dir: string,
	dest_base_dir = '',
	filter?: CopyFileFilter,
): Promise<AsyncCleanup> => {
	const path = join(dest_dir, dest_base_dir, source_path);
	const dir = dirname(path);

	const dir_already_exists = await fs_exists(dir);
	let root_created_dir: string | undefined;
	if (!dir_already_exists) {
		root_created_dir = await to_root_dir_that_doesnt_exist(dir);
		if (!root_created_dir) throw Error();
		await mkdir(dir, {recursive: true});
	}

	const path_already_exists = await fs_exists(path);
	if (!path_already_exists) {
		await cp(source_path, path, {recursive: true, filter});
	}

	return async () => {
		if (!dir_already_exists) {
			if (!root_created_dir) throw Error();
			if (await fs_exists(root_created_dir)) {
				await rm(root_created_dir, {recursive: true});
			}
		} else if (!path_already_exists) {
			if (await fs_exists(path)) {
				await rm(path, {recursive: true});
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
const create_temporarily = async (path: string, contents: string): Promise<AsyncCleanup> => {
	const dir = dirname(path);

	const dir_already_exists = await fs_exists(dir);
	let root_created_dir: string | undefined;
	if (!dir_already_exists) {
		root_created_dir = await to_root_dir_that_doesnt_exist(dir);
		if (!root_created_dir) throw Error();
		await mkdir(dir, {recursive: true});
	}

	const path_already_exists = await fs_exists(path);
	if (!path_already_exists) {
		await writeFile(path, contents, 'utf8');
	}

	return async () => {
		if (!dir_already_exists) {
			if (!root_created_dir) throw Error();
			if (await fs_exists(root_created_dir)) {
				await rm(root_created_dir, {recursive: true});
			}
		} else if (!path_already_exists) {
			if (await fs_exists(path)) {
				await rm(path);
			}
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
		if (await fs_exists(d)) {
			return prev;
		}
		prev = d;
	} while ((d = dirname(d)));
	throw Error('no dirs exist for ' + dir);
};
