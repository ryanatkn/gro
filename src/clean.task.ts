import {spawn} from '@feltcoop/felt/util/process.js';

import {type Task} from './task/task.js';
import {cleanFs} from './fs/clean.js';
import {type CleanTaskArgs} from './clean.js';
import {CleanTaskArgsSchema} from './clean.schema.js';

// TODO customize
const ORIGIN = 'origin';

export const task: Task<CleanTaskArgs> = {
	summary: 'remove temporary dev and build files, and optionally prune git branches',
	args: CleanTaskArgsSchema,
	run: async ({fs, log, args}): Promise<void> => {
		// TODO document with mdsvex
		await cleanFs(
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
