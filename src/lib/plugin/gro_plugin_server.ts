import {spawnRestartableProcess, type RestartableProcess} from '@feltjs/util/process.js';
import * as esbuild from 'esbuild';
import {cwd} from 'node:process';
import type {Config as SvelteKitConfig} from '@sveltejs/kit';
import {join} from 'node:path';

import type {Plugin, PluginContext} from './plugin.js';
import {SERVER_BUILD_BASE_PATH, SERVER_BUILD_NAME} from '../config/build_config_defaults.js';
import {paths} from '../path/paths.js';
import type {BuildName} from '../config/build_config.js';
import {watch_dir, type WatchNodeFs} from '../util/watch_dir.js';
import {load_sveltekit_config} from '../util/sveltekit_config.js';
import {esbuild_plugin_sveltekit_shim_app} from '../util/esbuild_plugin_sveltekit_shim_app.js';
import {esbuild_plugin_sveltekit_shim_env} from '../util/esbuild_plugin_sveltekit_shim_env.js';
import {print_build_result, to_define_import_meta_env} from '../util/esbuild_helpers.js';
import {esbuild_plugin_sveltekit_shim_alias} from '../util/esbuild_plugin_sveltekit_shim_alias.js';
import {esbuild_plugin_external_worker} from '../util/esbuild_plugin_external_worker.js';
import {esbuild_plugin_sveltekit_local_imports} from '../util/esbuild_plugin_sveltekit_local_imports.js';
import {exists} from '../util/exists.js';
import {esbuild_plugin_svelte} from '../util/esbuild_plugin_svelte.js';

export interface Options {
	dir?: string;
	build_name?: BuildName; // defaults to 'server'
	outdir?: string;
	outbase?: string;
	base_build_path?: string; // defaults to 'server/server.js'
	env_files?: string[];
	ambient_env?: Record<string, string>;
	sveltekit_config?: SvelteKitConfig;
	// TODO BLOCK tsconfig, including for Svelte preprocessor? esbuild `importsNotUsedAsValues` in particular
	// maybe use vite `loadConfig`? use other Vite options?
}

export const create_plugin = ({
	dir = cwd(),
	build_name = SERVER_BUILD_NAME,
	outdir = join(dir, '.gro/dev/' + build_name),
	outbase = paths.lib,
	base_build_path = SERVER_BUILD_BASE_PATH,
	env_files,
	ambient_env,
	sveltekit_config: sveltekit_config_option,
}: Partial<Options> = {}): Plugin<PluginContext> => {
	let build_ctx: esbuild.BuildContext;
	let watcher: WatchNodeFs;
	let server_process: RestartableProcess | null = null;

	return {
		name: 'gro_plugin_server',
		setup: async ({dev, watch, timings, config, log}) => {
			const sveltekit_config = sveltekit_config_option ?? (await load_sveltekit_config(dir));
			console.log(`sveltekit_config`, sveltekit_config);
			const alias = sveltekit_config?.kit?.alias;
			const public_prefix = sveltekit_config?.kit?.env?.publicPrefix;
			const private_prefix = sveltekit_config?.kit?.env?.privatePrefix;
			const env_dir = sveltekit_config?.kit?.env?.dir;
			// TODO BLOCK need to compile for SSR, hoisted option? `import.meta\.env.SSR` fallback?
			// TODO BLOCK sourcemap as a hoisted option? disable for production by default
			const svelte_compile_options = sveltekit_config?.compilerOptions;
			const svelte_preprocessors = sveltekit_config?.preprocess;

			const server_outfile = join(outdir, base_build_path);
			console.log(
				`outdir, base_build_path, server_outfile`,
				outdir,
				base_build_path,
				server_outfile,
			);

			const build_config = config.builds.find((c) => c.name === build_name);
			if (!build_config) throw Error('could not find build config ' + build_name);

			const timing_to_esbuild_create_context = timings.start('create build context');

			// TODO BLOCK source overrides from build_options: build_options_option
			const build_options: esbuild.BuildOptions = {
				outdir,
				outbase,
				format: 'esm',
				platform: 'node',
				packages: 'external',
				bundle: true,
				target: config.target,
			};

			build_ctx = await esbuild.context({
				entryPoints: build_config.input,
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
				define: to_define_import_meta_env(dev),
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

			if (!(await exists(server_outfile))) {
				throw Error(`Node server failed to start due to missing file: ${server_outfile}`);
			}

			server_process = spawnRestartableProcess('node', [server_outfile]);
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
