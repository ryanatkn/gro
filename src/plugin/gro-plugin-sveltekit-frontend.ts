import {spawn, Spawned_Process} from '@feltcoop/felt/util/process.js';
import {EMPTY_OBJECT} from '@feltcoop/felt/util/object.js';

import type {Plugin} from './plugin.js';
import type {Task_Events as Server_Task_Events} from '../server.task.js';
import type {Args} from '../task/task.js';

export interface Options {}

export interface Task_Args extends Args {
	watch?: boolean;
}

export const create_plugin = ({}: Partial<Options> = EMPTY_OBJECT): Plugin<
	Task_Args,
	Server_Task_Events
> => {
	let sveltekit_process: Spawned_Process | null = null;
	return {
		name: '@feltcoop/gro-adapter-sveltekit-frontend',
		setup: async ({args}) => {
			if (args.watch) {
				sveltekit_process = spawn('npx', ['svelte-kit', 'dev']);
			}
		},
		teardown: async () => {
			if (sveltekit_process) {
				sveltekit_process.child.kill();
				await sveltekit_process.closed;
			}
		},
	};
};
