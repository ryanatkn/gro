import {spawnRestartableProcess, type RestartableProcess} from '@feltjs/util/process.js';
import {existsSync} from 'node:fs';
import {type BuildContext, context as create_esbuild_context} from 'esbuild';
import {cwd} from 'node:process';

import type {Plugin, PluginContext} from './plugin.js';
import {
	NODE_SERVER_BUILD_BASE_PATH,
	NODE_SERVER_BUILD_NAME,
} from '../build/build_config_defaults.js';
import {paths} from '../path/paths.js';
import type {BuildName} from '../build/build_config.js';
import {watch_dir, type WatchNodeFs} from '../fs/watch_dir.js';
import {render_env_shim_module} from '../util/sveltekit_shim_env.js';
import {extname} from 'node:path';

const dir = cwd() + '/';

export interface Options {
	build_name: BuildName; // defaults to 'server'
	base_build_path?: string; // defaults to 'server/server.js'
}

export const create_plugin = ({
	build_name = NODE_SERVER_BUILD_NAME,
	base_build_path = NODE_SERVER_BUILD_BASE_PATH,
}: Partial<Options> = {}): Plugin<PluginContext<object>> => {
	let build_ctx: BuildContext;
	let watcher: WatchNodeFs;
	let server_process: RestartableProcess | null = null;

	return {
		name: 'gro_plugin_node_server',
		setup: async ({dev, timings, config}) => {
			if (!dev) return;

			const build_config = config.builds.find((c) => c.name === build_name);
			if (!build_config) throw Error('could not find build config ' + build_name);
			console.log(`build_config`, build_config);

			const SERVER_OUTDIR = '.gro/dev/' + build_name;
			const SERVER_OUTFILE = SERVER_OUTDIR + '/server/server.js';

			const timing_to_create_esbuild_context = timings.start('create esbuild context');
			build_ctx = await create_esbuild_context({
				entryPoints: build_config.input, // TODO BLOCK could map filters to files before calling this
				outdir: '.gro/dev/server/',
				format: 'esm',
				platform: 'node',
				packages: 'external',
				bundle: true,
				target: config.target,
				plugins: [
					// TODO BLOCK extract and refactor with the existing helpers for the loader+postprocess
					{
						name: 'sveltekit_shim_alias',
						setup: (build) => {
							const namespace = 'sveltekit_shim_alias_ns';
							const matcher = /^\$lib\//u;
							build.onResolve({filter: matcher}, (args) => {
								console.log(`[sveltekit_shim_alias] args`, args);
								const {path, importer} = args;

								if (!path.startsWith('$lib/')) return;
								let mapped = dir + 'src/' + path.slice(1);
								const ext = extname(mapped);
								if (ext !== '.ts' && ext !== '.js' && ext !== '.svelte') mapped += '.ts'; // TODO tricky because of files with `.(schema|task)` etc
								console.log(`[sveltekit_shim_alias] mapped`, mapped);
								return {path: mapped};
							});
						},
					},
					{
						name: 'sveltekit_shim_env',
						setup: (build) => {
							const namespace = 'sveltekit_shim_env_ns';
							const matcher = /^\$env\/(static|dynamic)\/(public|private)$/u;
							build.onResolve({filter: matcher}, ({path}) => ({path, namespace}));
							build.onLoad({filter: /.*/u, namespace}, (args) => {
								console.log(`[sveltekit_shim_env] args`, args);
								const {path} = args;
								const matches = matcher.exec(path);
								const public_prefix = 'PUBLIC_'; // TODO BLOCK config source
								const private_prefix = ''; // TODO BLOCK config source
								const env_dir = undefined; // TODO BLOCK config source
								const mode = matches![1] as 'static' | 'dynamic';
								const visibility = matches![2] as 'public' | 'private';
								return {
									contents: render_env_shim_module(
										true, // TODO BLOCK
										mode,
										visibility,
										public_prefix,
										private_prefix,
										env_dir,
									),
									loader: 'ts',
								};
							});
						},
					},
				],
			});
			timing_to_create_esbuild_context();
			// build.on('build', ({source_file, build_config}) => {
			// 	console.log(`source_file.id`, source_file.id);
			// 	if (source_file.id.endsWith('/gro/do/close.json')) {
			// 		console.log('CLOSE', source_file);
			// 		console.log(`build_config`, build_config);
			// 	}
			// });
			// TODO BLOCK can we watch dependencies of all of the files through esbuild?
			watcher = watch_dir({
				dir: paths.lib,
				on_change: async (change) => {
					console.log(`change`, change);
					// await build_ctx.rebuild(); // TODO BLOCK
					// server_process?.restart();
				},
			});

			console.log('INITIAL REBUILD');
			await build_ctx.rebuild();

			if (!existsSync(SERVER_OUTFILE)) {
				throw Error(`Node server failed to start due to missing file: ${SERVER_OUTFILE}`);
			}

			server_process = spawnRestartableProcess('node', [SERVER_OUTFILE]);
			console.log(`spawned`, server_process);
		},
		teardown: async ({dev}) => {
			if (!dev) return;

			if (server_process) {
				await server_process.kill();
				server_process = null;
			}
			if (build_ctx) {
				await build_ctx.dispose();
			}
		},
	};
};
