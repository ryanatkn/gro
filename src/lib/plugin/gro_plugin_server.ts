import {spawnRestartableProcess, type RestartableProcess} from '@feltjs/util/process.js';
import * as esbuild from 'esbuild';
import {cwd} from 'node:process';
import type {Config as SvelteKitConfig} from '@sveltejs/kit';
import {join} from 'node:path';

import type {Plugin, PluginContext} from './plugin.js';
import {BUILD_DEV_DIRNAME, BUILD_DIST_DIRNAME, paths} from '../util/paths.js';
import {watch_dir, type WatchNodeFs} from '../util/watch_dir.js';
import {init_sveltekit_config} from '../util/sveltekit_config.js';
import {esbuild_plugin_sveltekit_shim_app} from '../util/esbuild_plugin_sveltekit_shim_app.js';
import {esbuild_plugin_sveltekit_shim_env} from '../util/esbuild_plugin_sveltekit_shim_env.js';
import {print_build_result, to_define_import_meta_env} from '../util/esbuild_helpers.js';
import {esbuild_plugin_sveltekit_shim_alias} from '../util/esbuild_plugin_sveltekit_shim_alias.js';
import {esbuild_plugin_external_worker} from '../util/esbuild_plugin_external_worker.js';
import {esbuild_plugin_sveltekit_local_imports} from '../util/esbuild_plugin_sveltekit_local_imports.js';
import {exists} from '../util/exists.js';
import {esbuild_plugin_svelte} from '../util/esbuild_plugin_svelte.js';

export interface Options {
	/**
	 * same as esbuild's `entryPoints`
	 */
	entry_points: string[];
	/**
	 * @default cwd
	 */
	dir?: string;
	/**
	 * Returns the `Outpaths` given a `dev` param.
	 * Decoupling this from plugin creation allows it to be created generically,
	 * so the build and dev tasks can be the source of truth for `dev`.
	 */
	outpaths: CreateOutpaths;
	/**
	 * @default SvelteKit's `.env`, `.env.development`, and `.env.production`
	 */
	env_files?: string[];
	/**
	 * @default process.env
	 */
	ambient_env?: Record<string, string>;
	/**
	 * @default loaded from `${cwd}/svelte.config.js`
	 */
	sveltekit_config?: SvelteKitConfig;
	/**
	 * @default 'esnext'
	 */
	target: string;
}

export interface Outpaths {
	/**
	 * @default `${dir}/.gro/dev/server`
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

export interface CreateOutpaths {
	(dev: boolean): Outpaths;
}

export const create_plugin = ({
	entry_points,
	dir = cwd(),
	outpaths = (dev) => ({
		outdir: join(dir, dev ? BUILD_DEV_DIRNAME : BUILD_DIST_DIRNAME),
		outbase: paths.lib + 'server',
		outname: 'server.js',
	}),
	env_files,
	ambient_env,
	sveltekit_config: sveltekit_config_option,
	target = 'esnext',
}: Partial<Options> = {}): Plugin<PluginContext> => {
	let build_ctx: esbuild.BuildContext;
	let watcher: WatchNodeFs;
	let server_process: RestartableProcess | null = null;

	return {
		name: 'gro_plugin_server',
		setup: async ({dev, watch, timings, log}) => {
			// TODO BLOCK maybe cache this and return the parsed data on an object? see also the loader
			const {
				alias,
				base_url,
				env_dir,
				private_prefix,
				public_prefix,
				svelte_compile_options,
				svelte_preprocessors,
			} = await init_sveltekit_config(sveltekit_config_option ?? dir);
			// TODO BLOCK need to compile for SSR, hoisted option? `import.meta\.env.SSR` fallback?
			// TODO BLOCK sourcemap as a hoisted option? disable for production by default

			const {outbase, outdir, outname} = outpaths(dev);
			console.log(`outdir, outname`, outdir, outname);

			const server_outpath = join(outdir, outname);

			const timing_to_esbuild_create_context = timings.start('create build context');

			// TODO BLOCK source overrides from build_options: build_options_option
			const build_options: esbuild.BuildOptions = {
				outdir,
				outbase,
				format: 'esm',
				platform: 'node',
				packages: 'external',
				bundle: true,
				target,
			};

			build_ctx = await esbuild.context({
				entryPoints: entry_points,
				plugins: [
					esbuild_plugin_sveltekit_shim_app(),
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
					esbuild_plugin_svelte({dir, svelte_compile_options, svelte_preprocessors}),
					// TODO BLOCK maybe move this ahead of worker, if we call resolve internally
					esbuild_plugin_sveltekit_local_imports(),
				],
				define: to_define_import_meta_env(dev, base_url),
				...build_options,
			});
			timing_to_esbuild_create_context();

			// TODO BLOCK can we watch dependencies of all of the files through esbuild?
			if (watch) {
				watcher = watch_dir({
					dir: paths.lib,
					on_change: async (change) => {
						console.log(`change`, change);
						const result = await build_ctx.rebuild(); // TODO BLOCK
						print_build_result(log, result);
						// server_process?.restart();
					},
				});
				// await watcher.init();
				console.log(`WATCHING paths.lib`, paths.lib);
			}

			console.log('INITIAL REBUILD');
			await build_ctx.rebuild();

			console.log(`outdir, outname`, outdir, outname);
			if (!(await exists(server_outpath))) {
				throw Error(`Node server failed to start due to missing file: ${server_outpath}`);
			}

			server_process = spawnRestartableProcess('node', [server_outpath]);
		},
		teardown: async () => {
			if (server_process) {
				await server_process.kill();
				server_process = null;
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
