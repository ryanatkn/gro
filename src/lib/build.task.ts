import {z} from 'zod';

import type {Task} from './task.js';
import {Plugins} from './plugin.js';
import {clean_fs} from './clean.js';

export const Args = z
	.object({
		install: z.boolean({description: 'run npm install before building'}).default(false),
	})
	.strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'build the project',
	Args,
	run: async (ctx): Promise<void> => {
		const {config, args, invoke_task} = ctx;
		const {install} = args;

		await invoke_task('sync', {install});

		// TODO possibly detect if the git workspace is clean, and ask for confirmation if not,
		// because we're not doing things like `gro gen` here because that's a dev/CI concern

		await clean_fs({build_dist: true});

		const plugins = await Plugins.create({...ctx, config, dev: false, watch: false});
		await plugins.setup();
		await plugins.adapt();
		await plugins.teardown();
	},
};
