import {EMPTY_OBJECT} from '@feltjs/util/object.js';
import {spawnRestartableProcess, type RestartableProcess} from '@feltjs/util/process.js';

import type {Plugin, PluginContext} from './plugin.js';
import {API_SERVER_BUILD_BASE_PATH, API_SERVER_BUILD_NAME} from '../build/build_config_defaults.js';
import {to_build_out_dir} from '../path/paths.js';
import type {BuildName} from '../build/build_config.js';
import type {FilerEvents} from '../build/Filer.js';

// TODO import from felt instead

export interface Options {
	buildName: BuildName; // defaults to 'server'
	baseBuildPath?: string; // defaults to 'lib/server/server.js'
}

export const create_plugin = ({
	buildName = API_SERVER_BUILD_NAME,
	baseBuildPath = API_SERVER_BUILD_BASE_PATH,
}: Partial<Options> = EMPTY_OBJECT): Plugin<PluginContext<object, object>> => {
	let server_process: RestartableProcess | null = null;

	const on_filer_build: ({build_config}: FilerEvents['build']) => void = ({build_config}) => {
		if (server_process && build_config.name === buildName) {
			server_process.restart();
		}
	};

	return {
		name: 'gro_plugin_node_server',
		setup: async ({dev, fs, filer}) => {
			if (!dev) return;

			// When `src/lib/server/server.ts` or any of its dependencies change, restart the API server.
			const serverBuildPath = `${to_build_out_dir(dev)}/${buildName}/${baseBuildPath}`;

			if (!(await fs.exists(serverBuildPath))) {
				throw Error(`API server failed to start due to missing file: ${serverBuildPath}`);
			}

			// TODO what if we wrote out the port and
			// also, retried if it conflicted ports, have some affordance here to increment and write to disk
			// on disk, we can check for that file in `svelte.config.cjs`
			server_process = spawnRestartableProcess('node', [serverBuildPath]);
			// events.emit('server.spawn', spawned, path);
			// TODO remove event handler in `teardown`
			if (filer) {
				filer.on('build', on_filer_build);
			}
		},
		teardown: async ({dev, filer}) => {
			if (!dev) return;

			if (server_process) {
				await server_process.kill();
				server_process = null;
				if (filer) {
					filer.off('build', on_filer_build);
				}
			}
		},
	};
};
