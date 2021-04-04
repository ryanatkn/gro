import type {Task} from './task/task.js';
import {clean} from './project/clean.js';

export interface TaskArgs {
	B?: boolean; // !build
	D?: boolean; // !dist
	s?: boolean; // .svelte
	n?: boolean; // node_modules
}

export const task: Task<TaskArgs> = {
	description:
		'remove files: build/ (unless -B), dist/ (unless -D), and optionally .svelte/ (-s) and node_modules/ (-n)',
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
