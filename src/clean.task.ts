import {spawn} from '@feltcoop/felt/util/process.js';

import type {Task} from 'src/task/task.js';
import {clean_fs} from './fs/clean.js';

export interface TaskArgs {
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

export const task: Task<TaskArgs> = {
	summary: 'remove temporary dev and build files, and optionally prune git branches',
	run: async ({fs, log, args}): Promise<void> => {
		// TODO document with mdsvex
		await clean_fs(
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
			await spawn('git', ['remote', 'prune', ORIGIN]);
		}
	},
};
