import type {Spawned_Process} from '@feltcoop/felt/util/process.js';
import {EMPTY_OBJECT} from '@feltcoop/felt/util/object.js';

import type {Plugin} from './plugin.js';
import type {Task_Events as Server_Task_Events} from '../server.task.js';
import type {Args} from '../task/task.js';

export interface Options {
	api_server_path?: string;
}

export interface Task_Args extends Args {
	close_api_server?: (spawned: Spawned_Process) => Promise<void>; // let other tasks hang onto the api server
}

export const create_plugin = ({api_server_path}: Partial<Options> = EMPTY_OBJECT): Plugin<
	Task_Args,
	Server_Task_Events
> => {
	let spawned_api_server: Spawned_Process | null = null;
	return {
		name: '@feltcoop/gro-adapter-sveltekit-frontend',
		dev_setup: async ({events, invoke_task, args}) => {
			// TODO problem with this is it's used inside the dev task
			// should we...
			// 1: remove it from the dev task?
			// 2: extend the dev task behavior with results or side effects of plugins?
			// 3: rethink plugins?
			// let sveltekit_process: Spawned_Process | null = null;
			// if (await has_sveltekit_frontend(fs)) {
			// 	sveltekit_process = spawn('npx', ['svelte-kit', 'dev']);
			// }
		},
	};
};
