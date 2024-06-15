import {spawn_restartable_process, type Restartable_Process} from '@ryanatkn/belt/process.js';
import * as esbuild from 'esbuild';
import {cwd} from 'node:process';
import type {Config as SvelteKitConfig} from '@sveltejs/kit';
import {join, resolve} from 'node:path';
import {identity} from '@ryanatkn/belt/function.js';
import {strip_before, strip_end} from '@ryanatkn/belt/string.js';

import type {Plugin, Plugin_Context} from './plugin.js';
import {base_path_to_source_id, LIB_DIRNAME, paths, type Source_Id} from './paths.js';
import {GRO_DEV_DIRNAME, SERVER_DIST_PATH} from './path_constants.js';
import {watch_dir, type Watch_Node_Fs} from './watch_dir.js';
import {init_sveltekit_config} from './sveltekit_config.js';
import {esbuild_plugin_sveltekit_shim_app} from './esbuild_plugin_sveltekit_shim_app.js';
import {esbuild_plugin_sveltekit_shim_env} from './esbuild_plugin_sveltekit_shim_env.js';
import {print_build_result, to_define_import_meta_env} from './esbuild_helpers.js';
import {esbuild_plugin_sveltekit_shim_alias} from './esbuild_plugin_sveltekit_shim_alias.js';
import {esbuild_plugin_external_worker} from './esbuild_plugin_external_worker.js';
import {esbuild_plugin_sveltekit_local_imports} from './esbuild_plugin_sveltekit_local_imports.js';
import {exists} from './fs.js';
import {esbuild_plugin_svelte} from './esbuild_plugin_svelte.js';
import {throttle} from './throttle.js';
import {sveltekit_config_global} from './sveltekit_config_global.js';

// TODO sourcemap as a hoisted option? disable for production by default - or like `outpaths`, passed a `dev` param

export const SERVER_SOURCE_ID = base_path_to_source_id(LIB_DIRNAME + '/server/server.ts');

export const has_server = (path = SERVER_SOURCE_ID): Promise<boolean> => exists(path);

export interface Options {
	/**
	 * same as esbuild's `entryPoints`
	 */
	entry_points?: string[];
	/**
	 * @default cwd
	 */
	dir?: string;
	/**
	 * Returns the `Outpaths` given a `dev` param.
	 * Decoupling this from plugin creation allows it to be created generically,
	 * so the build and dev tasks can be the source of truth for `dev`.
	 */
	outpaths?: Create_Outpaths;
	/**
	 * @default SvelteKit's `.env`, `.env.development`, and `.env.production`
	 */
	env_files?: string[];
	/**
	 * @default process.env
	 */
	ambient_env?: Record<string, string>;
	/**
	 * @default loaded from `${cwd}/${SVELTEKIT_CONFIG_FILENAME}`
	 */
	sveltekit_config?: SvelteKitConfig;
	/**
	 * @default 'esnext'
	 */
	target?: string;
	/**
	 * Optionally map the esbuild options.
	 * @default identity
	 */
	esbuild_build_options?: (base_options: esbuild.BuildOptions) => esbuild.BuildOptions;
	/**
	 * Milliseconds to throttle rebuilds.
	 * Should be longer than it takes to build to avoid backpressure.
	 * @default 1000
	 */
	rebuild_throttle_delay?: number; // TODO could detect the backpressure problem and at least warn, shouldn't be a big deal
	/**
	 * The CLI command to run the server, like `'node'` or `'bun'` or `'deno'`.
	 * Receives the path to the server js file as its argument.
	 * @default 'node'
	 */
	cli_command?: string;
	/**
	 * Whether to run the server or not after building.
	 * @default dev
	 */
	run?: boolean;
}

export interface Outpaths {
	/**
	 * @default '.gro/dev' or 'dist_server'
	 */
	outdir: string;
	/**
	 * @default 'src/lib'
	 */
	outbase: string;
	/**
	 * @default 'server.js'
	 */
	outname: string;
}

export interface Create_Outpaths {
	(dev: boolean): Outpaths;
}

export const gro_plugin_server = ({
	entry_points = [SERVER_SOURCE_ID],
	dir = cwd(),
	outpaths = (dev) => ({
		outdir: join(dir, dev ? GRO_DEV_DIRNAME : SERVER_DIST_PATH),
		outbase: paths.lib,
		outname: 'server/server.js',
	}),
	env_files,
	ambient_env,
	sveltekit_config,
	target = 'esnext',
	esbuild_build_options = identity,
	rebuild_throttle_delay = 1000,
	cli_command = 'node',
	run, // `dev` default is not available in this scope
}: Options = {}): Plugin<Plugin_Context> => {
	let build_ctx: esbuild.BuildContext;
	let watcher: Watch_Node_Fs;
	let server_process: Restartable_Process | null = null;
	let deps: Set<Source_Id> | null = null;

	return {
		name: 'gro_plugin_server',
		setup: async ({dev, watch, timings, log}) => {
			const parsed_sveltekit_config =
				!sveltekit_config && strip_end(dir, '/') === cwd()
					? sveltekit_config_global
					: await init_sveltekit_config(sveltekit_config ?? dir);
			const {
				alias,
				base_url,
				assets_url,
				env_dir,
				private_prefix,
				public_prefix,
				svelte_compile_options,
				svelte_compile_module_options,
				svelte_preprocessors,
			} = parsed_sveltekit_config;

			// TODO hacky
			if (svelte_compile_options.generate === undefined) {
				svelte_compile_options.generate = 'server';
			}
			if (svelte_compile_module_options.generate === undefined) {
				svelte_compile_module_options.generate = 'server';
			}

			const {outbase, outdir, outname} = outpaths(dev);

			const server_outpath = join(outdir, outname);

			const timing_to_esbuild_create_context = timings.start('create build context');

			const build_options = esbuild_build_options({
				outdir,
				outbase,
				format: 'esm',
				platform: 'node',
				packages: 'external',
				bundle: true,
				target,
				metafile: watch,
			});

			build_ctx = await esbuild.context({
				entryPoints: entry_points.map((path) => resolve(dir, path)),
				plugins: [
					esbuild_plugin_sveltekit_shim_app({dev, base_url, assets_url}),
					esbuild_plugin_sveltekit_shim_env({
						dev,
						public_prefix,
						private_prefix,
						env_dir,
						env_files,
						ambient_env,
					}),
					esbuild_plugin_sveltekit_shim_alias({dir, alias}),
					esbuild_plugin_external_worker({
						dev,
						build_options,
						dir,
						svelte_compile_options,
						svelte_compile_module_options,
						svelte_preprocessors,
						alias,
						base_url,
						public_prefix,
						private_prefix,
						env_dir,
						env_files,
						ambient_env,
						log,
					}),
					esbuild_plugin_svelte({
						dir,
						svelte_compile_options,
						svelte_compile_module_options,
						svelte_preprocessors,
					}),
					esbuild_plugin_sveltekit_local_imports(),
				],
				define: to_define_import_meta_env(dev, base_url),
				...build_options,
			});

			timing_to_esbuild_create_context();

			const rebuild = throttle(async () => {
				let build_result;
				try {
					build_result = await build_ctx.rebuild();
				} catch (err) {
					log.error('[gro_plugin_server] build failed', err);
					return;
				}
				const {metafile} = build_result;
				if (!metafile) return;
				print_build_result(log, build_result);
				deps = parse_deps(metafile.inputs, dir);
				server_process?.restart();
			}, rebuild_throttle_delay);

			await rebuild();

			// uses chokidar instead of esbuild's watcher for efficiency
			if (watch) {
				let watcher_ready = false;
				// TODO maybe reuse this watcher globally via an option,
				// because it watches all of `$lib`, and that means it excludes `$routes`
				// while also including a lot of client files we don't care about,
				// but we can't discern which of `$lib` to watch ahead of time
				watcher = watch_dir({
					dir: paths.lib,
					on_change: (change) => {
						if (!watcher_ready || !deps?.has(change.path)) return;
						void rebuild();
					},
				});
				await watcher.init();
				watcher_ready = true;
			}

			if (!(await exists(server_outpath))) {
				throw Error(`Node server failed to start due to missing file: ${server_outpath}`);
			}

			if (run ?? dev) {
				server_process = spawn_restartable_process(cli_command, [server_outpath]);
			}
		},
		teardown: async () => {
			if (server_process) {
				const s = server_process; // avoid possible issue where a build is in progress, don't want to issue a restart, could be fixed upstream in `spawn_restartable_process`
				server_process = null;
				await s.kill();
			}
			if (watcher) {
				await watcher.close();
			}
			if (build_ctx) {
				await build_ctx.dispose();
			}
		},
	};
};

/**
 * The esbuild metafile contains the paths in `entryPoints` relative to the `dir`
 * even though we're resolving them to absolute paths before passing them to esbuild,
 * so we resolve them here relative to the `dir`.
 */
const parse_deps = (metafile_inputs: Record<string, unknown>, dir: string): Set<string> => {
	const deps = new Set<string>();
	for (const key in metafile_inputs) {
		deps.add(resolve(dir, strip_before(key, ':')));
	}
	return deps;
};
