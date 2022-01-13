import {EMPTY_OBJECT} from '@feltcoop/felt/util/object.js';
import {type RestartableProcess} from '@feltcoop/felt/util/process.js';
import {spawnRestartableProcess} from '@feltcoop/felt/util/process.js';

import type {Plugin, PluginContext} from 'src/plugin/plugin.js';
import {type Args} from 'src/task/task.js';
import {API_SERVER_BUILD_BASE_PATH, API_SERVER_BUILD_NAME} from '../build/buildConfigDefaults.js';
import {toBuildOutDir} from '../paths.js';
import type {BuildConfig, BuildName} from 'src/build/buildConfig.js';

// TODO import from felt instead

export interface Options {
	buildName: BuildName; // defaults to 'server'
	baseBuildPath?: string; // defaults to 'lib/server/server.js'
}

export interface TaskArgs extends Args {
	watch?: boolean;
}

export const createPlugin = ({
	buildName = API_SERVER_BUILD_NAME,
	baseBuildPath = API_SERVER_BUILD_BASE_PATH,
}: Partial<Options> = EMPTY_OBJECT): Plugin<PluginContext<TaskArgs, {}>> => {
	let serverProcess: RestartableProcess | null = null;

	// TODO type
	const onFilerBuild: ({buildConfig}: {buildConfig: BuildConfig}) => void = ({buildConfig}) => {
		if (serverProcess && buildConfig.name === buildName) {
			serverProcess.restart();
		}
	};

	return {
		name: '@feltcoop/groPluginApiServer',
		setup: async ({dev, fs, filer}) => {
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
		teardown: async ({filer}) => {
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
