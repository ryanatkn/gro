import {z} from 'zod';

import type {Task} from './task.js';
import {Plugins} from './plugin.js';
import {clean_fs} from './clean_fs.js';
import {to_forwarded_args} from './args.js';

export const Args = z.object({}).strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'build the project',
	Args,
	run: async (ctx): Promise<void> => {
		const {invoke_task} = ctx;

		await invoke_task('sync', to_forwarded_args('gro sync'));

		// TODO possibly detect if the git workspace is clean, and ask for confirmation if not,
		// because we're not doing things like `gro gen` here because that's a dev/CI concern

		await clean_fs({build_dist: true});

		const plugins = await Plugins.create({...ctx, dev: false, watch: false});
		await plugins.setup();
		await plugins.adapt();
		await plugins.teardown();
	},
};
