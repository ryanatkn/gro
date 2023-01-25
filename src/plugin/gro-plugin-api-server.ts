import {EMPTY_OBJECT} from '@feltcoop/util/object.js';
import {spawnRestartableProcess, type RestartableProcess} from '@feltcoop/util/process.js';

import type {Plugin, PluginContext} from './plugin.js';
import {API_SERVER_BUILD_BASE_PATH, API_SERVER_BUILD_NAME} from '../build/buildConfigDefaults.js';
import {toBuildOutDir} from '../paths.js';
import type {BuildName} from '../build/buildConfig.js';
import type {FilerEvents} from '../build/Filer.js';

// TODO import from felt instead

export interface Options {
	buildName: BuildName; // defaults to 'server'
	baseBuildPath?: string; // defaults to 'lib/server/server.js'
}

export const createPlugin = ({
	buildName = API_SERVER_BUILD_NAME,
	baseBuildPath = API_SERVER_BUILD_BASE_PATH,
}: Partial<Options> = EMPTY_OBJECT): Plugin<PluginContext<object, object>> => {
	let serverProcess: RestartableProcess | null = null;

	const onFilerBuild: ({buildConfig}: FilerEvents['build']) => void = ({buildConfig}) => {
		if (serverProcess && buildConfig.name === buildName) {
			serverProcess.restart();
		}
	};

	return {
		name: '@feltjs/gro-plugin-api-server',
		setup: async ({dev, fs, filer}) => {
			if (!dev) return;

			// When `src/lib/server/server.ts` or any of its dependencies change, restart the API server.
			const serverBuildPath = `${toBuildOutDir(dev)}/${buildName}/${baseBuildPath}`;

			if (!(await fs.exists(serverBuildPath))) {
				throw Error(`API server failed to start due to missing file: ${serverBuildPath}`);
			}

			// TODO what if we wrote out the port and
			// also, retried if it conflicted ports, have some affordance here to increment and write to disk
			// on disk, we can check for that file in `svelte.config.cjs`
			serverProcess = spawnRestartableProcess('node', [serverBuildPath]);
			// events.emit('server.spawn', spawned, path);
			// TODO remove event handler in `teardown`
			if (filer) {
				filer.on('build', onFilerBuild);
			}
		},
		teardown: async ({dev, filer}) => {
			if (!dev) return;

			if (serverProcess) {
				await serverProcess.kill();
				serverProcess = null;
				if (filer) {
					filer.off('build', onFilerBuild);
				}
			}
		},
	};
};
