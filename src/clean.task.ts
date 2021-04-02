import type {Task} from './task/task.js';
import {clean} from './project/clean.js';

export const task: Task = {
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
