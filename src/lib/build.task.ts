import {z} from 'zod';
import {spawn} from '@ryanatkn/belt/process.js';

import {Task_Error, type Task} from './task.ts';
import {Plugins} from './plugin.ts';
import {clean_fs} from './clean_fs.ts';

export const Args = z.strictObject({
	sync: z.boolean().meta({description: 'dual of no-sync'}).default(true),
	'no-sync': z.boolean().meta({description: 'opt out of gro sync'}).default(false),
	install: z.boolean().meta({description: 'dual of no-install'}).default(true),
	'no-install': z // convenience, same as `gro build -- gro sync --no-install` but the latter takes precedence
		.boolean()
		.meta({description: 'opt out of installing packages before building'})
		.default(false),
});
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'build the project',
	Args,
	run: async (ctx): Promise<void> => {
		const {args, invoke_task, config} = ctx;
		const {sync, install} = args;

		if (sync) {
			await invoke_task('sync', {install});
		} else if (install) {
			const result = await spawn(config.pm_cli, ['install']);
			if (!result.ok) {
				throw new Task_Error(`Failed \`${config.pm_cli} install\``);
			}
		}

		// TODO possibly detect if the git workspace is clean, and ask for confirmation if not,
		// because we're not doing things like `gro gen` here because that's a dev/CI concern

		await clean_fs({build_dist: true});

		const plugins = await Plugins.create({...ctx, dev: false, watch: false});
		await plugins.setup();
		await plugins.adapt();
		await plugins.teardown();
	},
};
