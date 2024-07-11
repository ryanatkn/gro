import {z} from 'zod';

import type {Task} from './task.js';
import {Plugins, type Plugin_Context} from './plugin.js';
import {clean_fs} from './clean_fs.js';

export const Args = z
	.object({
		watch: z.boolean({description: 'dual of no-watch'}).default(true),
		'no-watch': z
			.boolean({
				description:
					'opt out of running a long-lived process to watch files and rebuild on changes',
			})
			.default(false),
		sync: z.boolean({description: 'dual of no-sync'}).default(true),
		'no-sync': z.boolean({description: 'opt out of gro sync'}).default(false),
		install: z.boolean({description: 'dual of no-install'}).default(true),
		'no-install': z // convenience, same as `gro dev -- gro sync --no-install` but the latter takes precedence
			.boolean({description: 'opt out of `npm install` before starting the dev server'})
			.default(false),
	})
	.strict();
export type Args = z.infer<typeof Args>;

export type DevTask_Context = Plugin_Context<Args>;

export const task: Task<Args> = {
	summary: 'start SvelteKit and other dev plugins',
	Args,
	run: async (ctx) => {
		const {args, invoke_task} = ctx;
		const {watch, sync, install} = args;

		await clean_fs({build_dev: true});

		if (sync) {
			await invoke_task('sync', {install});
		}

		const plugins = await Plugins.create({...ctx, dev: true, watch});
		await plugins.setup();
		if (!watch) {
			await plugins.teardown();
		}
	},
};
