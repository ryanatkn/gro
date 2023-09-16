import {z} from 'zod';

import type {Task} from './task/task.js';
import {Plugins, type PluginContext} from './plugin/plugin.js';
import {clean_fs} from './util/clean.js';

export const Args = z
	.object({
		watch: z.boolean({description: 'dual of no-watch'}).default(true),
		'no-watch': z
			.boolean({
				description:
					'opt out of running a long-lived process to watch files and rebuild on changes',
			})
			.default(false),
	})
	.strict();
export type Args = z.infer<typeof Args>;

export type DevTaskContext = PluginContext<Args>;

export const task: Task<Args> = {
	summary: 'start SvelteKit and other dev plugins',
	Args,
	run: async (ctx) => {
		const {
			args: {watch},
		} = ctx;

		await clean_fs({build_dev: true});

		// TODO BLOCK enable this
		// await invoke_task('gen');

		const plugins = await Plugins.create({...ctx, dev: true, watch});

		await plugins.setup();

		if (!watch) {
			await plugins.teardown();
		}
	},
};
