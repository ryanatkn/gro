import type {Task} from './task/task.js';
import {clean} from './fs/clean.js';

export interface TaskArgs {
	B?: boolean; // !build
	D?: boolean; // !dist
	s?: boolean; // .svelte
	n?: boolean; // node_modules
}

export const task: Task<TaskArgs> = {
	description: 'remove temporary dev and build files',
	run: async ({log, args}): Promise<void> => {
		// TODO document with mdsvex
		await clean(
			{
				build: !args.B,
				dist: !args.D,
				svelteKit: !!args.s,
				nodeModules: !!args.n,
			},
			log,
		);
	},
};
