import type {Task} from './task/task.js';
import {clean} from './project/clean.js';

export const task: Task = {
	description: 'remove files: build, dist, and optionally SvelteKit (-s) and node_modules (-n)',
	run: async ({log, args}): Promise<void> => {
		// TODO document with mdsvex
		await clean(log, {
			svelteKit: !!(args.s || args.sveltekit),
			nodeModules: !!(args.n || args.nodemodules),
			// TODO maybe control `build` and `dist` too? how to do that cleanly,
			// and maybe improve this interface?
		});
	},
};
