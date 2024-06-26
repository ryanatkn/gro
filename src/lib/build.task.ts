import {z} from 'zod';

import type {Task} from './task.js';
import {Plugins} from './plugin.js';
import {clean_fs} from './clean_fs.js';

export const Args = z
	.object({
		install: z.boolean({description: 'dual of no-install'}).default(true),
		'no-install': z
			.boolean({description: 'opt out of npm installing before building'})
			.default(false),
	})
	.strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'build the project',
	Args,
	run: async (ctx): Promise<void> => {
		const {args, invoke_task} = ctx;
		const {install} = args;

		// By default `gro build` installs, opposite of `gro sync`, so that arg needs special handling.
		await invoke_task('sync', {install});

		// TODO possibly detect if the git workspace is clean, and ask for confirmation if not,
		// because we're not doing things like `gro gen` here because that's a dev/CI concern

		await clean_fs({build_dist: true});

		const plugins = await Plugins.create({...ctx, dev: false, watch: false});
		await plugins.setup();
		await plugins.adapt();
		await plugins.teardown();
	},
};
