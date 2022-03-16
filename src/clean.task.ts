import {spawn} from '@feltcoop/felt/util/process.js';

import type {Task} from './task/task.js';
import {cleanFs} from './fs/clean.js';
import type {CleanTaskArgs} from './cleanTask.js';
import {CleanTaskArgsSchema} from './cleanTask.schema.js';

// TODO customize
const ORIGIN = 'origin';

export const task: Task<CleanTaskArgs> = {
	summary: 'remove temporary dev and build files, and optionally prune git branches',
	args: CleanTaskArgsSchema,
	run: async ({fs, log, args}): Promise<void> => {
		const {build, dist, sveltekit, nodemodules, git} = args;

		// TODO document with mdsvex
		await cleanFs(fs, {build, dist, sveltekit, nodemodules}, log);

		// lop off unwanted git branches
		if (git) {
			await spawn('git', ['remote', 'prune', ORIGIN]);
		}
	},
};
