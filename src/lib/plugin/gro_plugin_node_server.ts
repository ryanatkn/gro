import {EMPTY_OBJECT} from '@feltjs/util/object.js';
import {spawnRestartableProcess, type RestartableProcess} from '@feltjs/util/process.js';
import {existsSync} from 'node:fs';
import {type BuildContext, context as create_esbuild_context} from 'esbuild';

import type {Plugin, PluginContext} from './plugin.js';
import {
	NODE_SERVER_BUILD_BASE_PATH,
	NODE_SERVER_BUILD_NAME,
} from '../build/build_config_defaults.js';
import {paths, to_build_out_dir} from '../path/paths.js';
import type {BuildName} from '../build/build_config.js';
import {watch_dir, type WatchNodeFs} from '../fs/watch_dir.js';

// TODO import from felt instead

export interface Options {
	build_name: BuildName; // defaults to 'server'
	base_build_path?: string; // defaults to 'lib/server/server.js'
}

export const create_plugin = ({
	build_name = NODE_SERVER_BUILD_NAME,
	base_build_path = NODE_SERVER_BUILD_BASE_PATH,
}: Partial<Options> = EMPTY_OBJECT): Plugin<PluginContext<object>> => {
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
			const SERVER_OUTFILE = SERVER_OUTDIR + '/server.js';

			const timing_to_create_esbuild_context = timings.start('create filer');
			build_ctx = await create_esbuild_context({
				entryPoints: build_config.input, // TODO BLOCK could map filters to files before calling this
				outdir: '.gro/dev/server/',
				format: 'esm',
				platform: 'node',
				packages: 'external',
				bundle: true,
				target: config.target,
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
					await build_ctx.rebuild(); // TODO BLOCK
					server_process?.restart();
				},
			});

			console.log('INITIAL REBUILD');
			await build_ctx.rebuild();

			if (!existsSync(SERVER_OUTFILE)) {
				throw Error(`API server failed to start due to missing file: ${SERVER_OUTFILE}`);
			}

			server_process = spawnRestartableProcess('node', [SERVER_OUTFILE]);
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
