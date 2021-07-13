import {EMPTY_OBJECT} from '@feltcoop/felt/util/object.js';
import type {Restartable_Process} from '@feltcoop/felt/util/process.js';
import {spawn_restartable_process} from '@feltcoop/felt/util/process.js';

import type {Plugin} from 'src/plugin/plugin.js';
import type {Args} from 'src/task/task.js';
import {API_SERVER_BUILD_BASE_PATH, API_SERVER_BUILD_NAME} from '../build/build_config_defaults.js';
import {to_build_out_dir} from '../paths.js';
import type {Build_Config, Build_Name} from 'src/build/build_config.js';

// TODO import from felt instead

export interface Options {
	build_name: Build_Name; // defaults to 'server'
	base_build_path?: string; // defaults to 'lib/server/server.js'
}

export interface Task_Args extends Args {
	watch?: boolean;
}

export const create_plugin = ({
	build_name = API_SERVER_BUILD_NAME,
	base_build_path = API_SERVER_BUILD_BASE_PATH,
}: Partial<Options> = EMPTY_OBJECT): Plugin<Task_Args, {}> => {
	let server_process: Restartable_Process | null = null;

	// TODO type
	const on_filer_build: ({build_config}: {build_config: Build_Config}) => void = ({
		build_config,
	}) => {
		if (server_process && build_config.name === build_name) {
			server_process.restart();
		}
	};

	return {
		name: '@feltcoop/gro_plugin_sveltekit_frontend',
		setup: async ({dev, fs, filer}) => {
			// When `src/lib/server/server.ts` or any of its dependencies change, restart the API server.
			const server_build_path = `${to_build_out_dir(dev)}/${build_name}/${base_build_path}`;

			if (!(await fs.exists(server_build_path))) {
				throw Error(`API server failed to start due to missing file: ${server_build_path}`);
			}

			// TODO what if we wrote out the port and
			// also, retried if it conflicted ports, have some affordance here to increment and write to disk
			// on disk, we can check for that file in `svelte.config.cjs`
			server_process = spawn_restartable_process('node', [server_build_path]);
			// events.emit('server.spawn', spawned, path);
			// TODO remove event handler in `teardown`
			if (filer) {
				filer.on('build', on_filer_build);
			}
		},
		teardown: async ({filer}) => {
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
