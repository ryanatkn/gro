import type {Task} from './task/task.js';
import {clean} from './fs/clean.js';
import {spawnProcess} from './utils/process.js';

export interface TaskArgs {
	'no-build'?: boolean; // !`/.gro`
	'no-dist'?: boolean; // !`/dist`
	svelte?: boolean; // `/.svelte`
	nodemodules: boolean; // `/node_modules`
	git?: boolean; // `git remote prune origin`
}

// TODO customize
const ORIGIN = 'origin';

export const task: Task<TaskArgs> = {
	description: 'remove temporary dev and build files, and optionally prune git branches',
	run: async ({fs, log, args}): Promise<void> => {
		// TODO document with mdsvex
		await clean(
			fs,
			{
				build: !args['no-build'],
				dist: !args['no-dist'],
				svelteKit: !!args.svelte,
				nodeModules: !!args.nodemodules,
			},
			log,
		);

		// lop off unwanted git branches
		if (args.git) {
			await spawnProcess('git', ['remote', 'prune', ORIGIN]);
		}
	},
};
