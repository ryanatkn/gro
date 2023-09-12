import {spawnRestartableProcess, type RestartableProcess} from '@feltjs/util/process.js';
import {existsSync} from 'node:fs';
import * as esbuild from 'esbuild';
import {cwd} from 'node:process';
import type {Config as SvelteKitConfig} from '@sveltejs/kit';

import type {Plugin, PluginContext} from './plugin.js';
import {
	NODE_SERVER_BUILD_BASE_PATH,
	NODE_SERVER_BUILD_NAME,
} from '../config/build_config_defaults.js';
import {paths} from '../path/paths.js';
import type {BuildName} from '../config/build_config.js';
import {watch_dir, type WatchNodeFs} from '../util/watch_dir.js';
import {load_sveltekit_config} from '../util/sveltekit_config.js';
import {esbuild_plugin_sveltekit_shim_app} from '../util/esbuild_plugin_sveltekit_shim_app.js';
import {esbuild_plugin_sveltekit_shim_env} from '../util/esbuild_plugin_sveltekit_shim_env.js';
import {print_build_result} from '../util/esbuild_helpers.js';
import {esbuild_plugin_sveltekit_shim_alias} from '../util/esbuild_plugin_sveltekit_shim_alias.js';
import {esbuild_plugin_external_worker} from '../util/esbuild_plugin_external_worker.js';
import {esbuild_plugin_sveltekit_local_imports} from '../util/esbuild_plugin_sveltekit_local_imports.js';

export interface Options {
	dir?: string;
	build_name?: BuildName; // defaults to 'server'
	outdir?: string;
	outbase?: string;
	base_build_path?: string; // defaults to 'server/server.js'
	env_files?: string[];
	ambient_env?: Record<string, string>;
	sveltekit_config?: SvelteKitConfig;
}

export const create_plugin = ({
	dir = cwd() + '/',
	build_name = NODE_SERVER_BUILD_NAME,
	outdir = dir + '.gro/dev/' + build_name,
	outbase = paths.lib,
	base_build_path = NODE_SERVER_BUILD_BASE_PATH,
	env_files,
	ambient_env,
	sveltekit_config: sveltekit_config_option,
}: Partial<Options> = {}): Plugin<PluginContext> => {
	let build_ctx: esbuild.BuildContext;
	let watcher: WatchNodeFs;
	let server_process: RestartableProcess | null = null;

	return {
		name: 'gro_plugin_node_server',
		setup: async ({dev, watch, timings, config, log}) => {
			const sveltekit_config = sveltekit_config_option ?? (await load_sveltekit_config(dir));
			const alias = sveltekit_config?.kit?.alias;
			const public_prefix = sveltekit_config?.kit?.env?.publicPrefix;
			const private_prefix = sveltekit_config?.kit?.env?.privatePrefix;
			const env_dir = sveltekit_config?.kit?.env?.dir;
			// TODO BLOCK support Svelte imports?
			// const compiler_options = sveltekit_config?.compilerOptions;

			const server_outfile = outdir + '/' + base_build_path;
			console.log(
				`outdir, base_build_path, server_outfile`,
				outdir,
				base_build_path,
				server_outfile,
			);

			const build_config = config.builds.find((c) => c.name === build_name);
			if (!build_config) throw Error('could not find build config ' + build_name);

			const timing_to_esbuild_create_context = timings.start('create build context');

			const build_options: Pick<
				esbuild.BuildOptions,
				'outdir' | 'outbase' | 'format' | 'platform' | 'packages' | 'bundle' | 'target'
			> = {
				outdir,
				outbase,
				format: 'esm',
				platform: 'node',
				packages: 'external',
				bundle: true,
				target: config.target,
			};

			build_ctx = await esbuild.context({
				...build_options,
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
						log,
						build_options,
						dir,
						alias,
						public_prefix,
						private_prefix,
						env_dir,
						env_files,
						ambient_env,
					}),
					esbuild_plugin_sveltekit_local_imports(),
				],
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

			if (!existsSync(server_outfile)) {
				throw Error(`Node server failed to start due to missing file: ${server_outfile}`);
			}

			server_process = spawnRestartableProcess('node', [server_outfile]);
			console.log(`spawned`, server_process);
		},
		teardown: async () => {
			console.log('TEARING DOWN');

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
