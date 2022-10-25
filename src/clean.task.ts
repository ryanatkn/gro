import {spawn} from '@feltcoop/felt/util/process.js';

import type {Task} from './task/task.js';
import {cleanFs} from './fs/clean.js';
import type {ArgsSchema} from './utils/args.js';
import {toVocabSchema} from './utils/schema.js';
import {z} from 'zod';

// TODO customize
const ORIGIN = 'origin';

const Args = z.object({
	build: z.boolean({description: ''}).default(true),
	'no-build': z
		.boolean({description: 'opt out of deleting the Gro build directory .gro/'})
		.default(false)
		.optional(),
	dist: z.boolean({description: ''}).default(true),
	'no-dist': z
		.boolean({description: 'opt out of deleting the Gro dist directory dist/'})
		.default(false)
		.optional(),
	sveltekit: z
		.boolean({description: 'delete the SvelteKit directory .svelte-kit/ and Vite cache'})
		.default(false),
	nodemodules: z.boolean({description: 'delete node_modules/'}).default(false),
	git: z
		.boolean({
			description:
				'run "git remote prune" to delete local branches referencing nonexistent remote branches',
		})
		.default(false),
});
type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'remove temporary dev and build files, and optionally prune git branches',
	Args,
	args: toVocabSchema(Args, 'CleanTaskArgs') as ArgsSchema,
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
