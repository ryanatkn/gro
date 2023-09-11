import {spawn} from '@feltjs/util/process.js';
import {z} from 'zod';

import type {Task} from './task/task.js';
import {clean_fs} from './util/clean.js';

// TODO customize
const ORIGIN = 'origin';

export const Args = z
	.object({
		build: z.boolean({description: 'read this instead of no-build'}).default(true),
		'no-build': z
			.boolean({description: 'opt out of deleting the Gro build directory .gro/'})
			.optional()
			.default(false),
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
	})
	.strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'remove temporary dev and build files, and optionally prune git branches',
	Args,
	run: async ({log, args}): Promise<void> => {
		const {build, dist, sveltekit, nodemodules, git} = args;

		// TODO document with mdsvex
		clean_fs({build, dist, sveltekit, nodemodules}, log);

		// lop off unwanted git branches
		if (git) {
			await spawn('git', ['remote', 'prune', ORIGIN]);
		}
	},
};
