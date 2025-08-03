import {z} from 'zod';
import {spawn} from '@ryanatkn/belt/process.js';

import {Task_Error, type Task} from './task.ts';
import {Plugins, type Plugin_Context} from './plugin.ts';
import {clean_fs} from './clean_fs.ts';

export const Args = z.strictObject({
	watch: z.boolean().meta({description: 'dual of no-watch'}).default(true),
	'no-watch': z
		.boolean()
		.meta({
			description: 'opt out of running a long-lived process to watch files and rebuild on changes',
		})
		.default(false),
	sync: z.boolean().meta({description: 'dual of no-sync'}).default(true),
	'no-sync': z.boolean().meta({description: 'opt out of gro sync'}).default(false),
	install: z.boolean().meta({description: 'opt into installing packages'}).default(false),
});
export type Args = z.infer<typeof Args>;

export type DevTask_Context = Plugin_Context<Args>;

export const task: Task<Args> = {
	summary: 'start SvelteKit and other dev plugins',
	Args,
	run: async (ctx) => {
		const {args, invoke_task, config} = ctx;
		const {watch, sync, install} = args;

		await clean_fs({build_dev: true});

		if (sync) {
			await invoke_task('sync', {install});
		} else if (install) {
			const result = await spawn(config.pm_cli, ['install']);
			if (!result.ok) throw new Task_Error(`Failed \`${config.pm_cli} install\``);
		}

		const plugins = await Plugins.create({...ctx, dev: true, watch});
		await plugins.setup();
		if (!watch) {
			await plugins.teardown();
		}
	},
};
