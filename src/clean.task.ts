import {spawn_process} from '@feltcoop/felt/util/process.js';

import type {Task} from './task/task.js';
import {clean} from './fs/clean.js';

export interface Task_Args {
	build?: boolean; // !`/.gro`
	'no-build'?: boolean; // !`/.gro`
	dist?: boolean; // !`/dist`
	'no-dist'?: boolean; // !`/dist`
	sveltekit?: boolean; // `/.svelte-kit`
	nodemodules: boolean; // `/nodemodules`
	git?: boolean; // `git remote prune origin`
}

// TODO customize
const ORIGIN = 'origin';

export const task: Task<Task_Args> = {
	description: 'remove temporary dev and build files, and optionally prune git branches',
	run: async ({fs, log, args}): Promise<void> => {
		// TODO document with mdsvex
		await clean(
			fs,
			{
				build: !args.build,
				dist: !args.dist,
				sveltekit: !!args.sveltekit,
				nodemodules: !!args.nodemodules,
			},
			log,
		);

		// lop off unwanted git branches
		if (args.git) {
			await spawn_process('git', ['remote', 'prune', ORIGIN]);
		}
	},
};
