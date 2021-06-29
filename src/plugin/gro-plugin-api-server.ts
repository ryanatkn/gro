import type {Spawned_Process} from '@feltcoop/felt/util/process.js';
import {EMPTY_OBJECT} from '@feltcoop/felt/util/object.js';

import type {Plugin} from './plugin.js';
import type {Task_Events as Server_Task_Events} from '../server.task.js';
import type {Args} from '../task/task.js';

export interface Options {
	api_server_path?: string;
}

export interface Task_Args extends Args {}

export const create_plugin = ({api_server_path}: Partial<Options> = EMPTY_OBJECT): Plugin<
	Task_Args,
	Server_Task_Events
> => {
	let api_server_process: Spawned_Process | null = null;
	return {
		name: '@feltcoop/gro-adapter-sveltekit-frontend',
		setup: async ({events, invoke_task, args}) => {
			events.once('server.spawn', (spawned) => {
				api_server_process = spawned;
			});
			await invoke_task('server', {...args, api_server_path});
		},
		teardown: async () => {
			api_server_process!.child.kill();
			await api_server_process!.closed;
		},
	};
};
