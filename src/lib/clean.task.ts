import {spawn} from '@feltjs/util/process.js';
import {z} from 'zod';

import type {Task} from './task/task.js';
import {clean_fs} from './util/clean.js';

export const Args = z
	.object({
		dist: z.boolean({description: 'read this instead of no-dist'}).default(true),
		'no-dist': z
			.boolean({description: 'opt out of deleting the Gro dist directory dist/'})
			.optional()
			.default(false),
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
		git_origin: z
			.string({
				description: 'the origin to "git remote prune"',
			})
			.default('origin'),
	})
	.strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'remove temporary dev and build files, and optionally prune git branches',
	Args,
	run: async ({log, args}): Promise<void> => {
		const {dist, sveltekit, nodemodules, git, git_origin} = args;

		clean_fs({build: !dist, dist, sveltekit, nodemodules}, log);
		console.log(`dist`, dist);

		// lop off stale git branches
		if (git) {
			await spawn('git', ['remote', 'prune', git_origin]);
		}
	},
};
