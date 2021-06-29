import {spawn, Spawned_Process, spawn_process} from '@feltcoop/felt/util/process.js';
import {EMPTY_OBJECT} from '@feltcoop/felt/util/object.js';

import type {Plugin} from './plugin.js';
import type {Args} from '../task/task.js';

export interface Options {}

export interface Task_Args extends Args {
	watch?: boolean;
}

export const create_plugin = ({}: Partial<Options> = EMPTY_OBJECT): Plugin<Task_Args, {}> => {
	let sveltekit_process: Spawned_Process | null = null;
	return {
		name: '@feltcoop/gro-adapter-sveltekit-frontend',
		setup: async ({dev, args, log}) => {
			if (dev) {
				if (args.watch) {
					sveltekit_process = spawn('npx', ['svelte-kit', 'dev']);
				} else {
					log.warn(
						'The SvelteKit Gro plugin is loaded but will not output anything' +
							' because `dev` is true and `watch` is false',
					);
				}
			} else {
				await spawn_process('npx', ['svelte-kit', 'build']);
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
