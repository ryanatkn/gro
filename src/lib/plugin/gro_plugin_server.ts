import {spawnRestartableProcess, type RestartableProcess} from '@feltjs/util/process.js';
import * as esbuild from 'esbuild';
import {cwd} from 'node:process';
import type {Config as SvelteKitConfig} from '@sveltejs/kit';
import {join, resolve} from 'node:path';
import {identity} from '@feltjs/util/function.js';

import type {Plugin, PluginContext} from './plugin.js';
import {BUILD_DEV_DIRNAME, BUILD_DIST_DIRNAME, paths, type SourceId} from '../util/paths.js';
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
import {stripBefore} from '@feltjs/util/string.js';
import {throttle} from '$lib/util/throttle.js';

// TODO sourcemap as a hoisted option? disable for production by default - or like `outpaths`, passed a `dev` param

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
	outpaths?: CreateOutpaths;
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
	target?: string;
	/**
	 * Optionally map the esbuild options.
	 * @default identity
	 */
	esbuild_build_options?: (base_options: esbuild.BuildOptions) => esbuild.BuildOptions;
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

export const plugin = ({
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
	esbuild_build_options = identity,
}: Options): Plugin<PluginContext> => {
	let build_ctx: esbuild.BuildContext;
	let watcher: WatchNodeFs;
	let server_process: RestartableProcess | null = null;
	let deps: Set<SourceId> | null = null;

	return {
		name: 'gro_plugin_server',
		setup: async ({dev, watch, timings, log}) => {
			const {
				alias,
				base_url,
				env_dir,
				private_prefix,
				public_prefix,
				svelte_compile_options,
				svelte_preprocessors,
			} = await init_sveltekit_config(sveltekit_config_option ?? dir);

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
					esbuild_plugin_sveltekit_local_imports(),
				],
				define: to_define_import_meta_env(dev, base_url),
				...build_options,
			});

			timing_to_esbuild_create_context();

			const rebuild = throttle(async () => {
				console.log('CALLING REBUILD');
				const build_result = await build_ctx.rebuild();
				console.log('DONE BUILDING');
				const {metafile} = build_result;
				if (!metafile) return;
				print_build_result(log, build_result);
				deps = parse_deps(metafile.inputs, dir);
				console.log('RESTARTING!!!!!!!!!!!!!!!!!!!!\n!!!!!!!!!!!!!!!!!!!');
				server_process?.restart();
			}, 4000); // TODO BLOCK delay?

			console.log('INITIAL REBUILD');
			await rebuild();

			// TODO BLOCK handle src/ paths (configure esbuild ?)
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

			console.log('STARTING NODE SERVER');
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

/**
 * The esbuild metafile contains the paths in `entryPoints` relative to the `dir`
 * even though we're resolving them to absolute paths before passing them to esbuild,
 * so we resolve them here relative to the `dir`.
 */
const parse_deps = (metafile_inputs: Record<string, unknown>, dir: string): Set<string> => {
	const deps = new Set<string>();
	for (const key in metafile_inputs) {
		deps.add(resolve(dir, stripBefore(key, ':')));
	}
	return deps;
};
