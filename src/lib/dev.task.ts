import {z} from 'zod';

import type {Task} from './task/task.js';
import {Plugins, type PluginContext} from './plugin/plugin.js';

export const Args = z
	.object({
		watch: z.boolean({description: 'readable dual of no-watch'}).default(true),
		'no-watch': z
			.boolean({
				description:
					'opt out of running a long-lived process to watch files and rebuild on changes',
			})
			.optional() // TODO behavior differs now with zod, because of `default` this does nothing
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

		// TODO BLOCK enable this
		// await invoke_task('gen');

		const plugins = await Plugins.create({...ctx, dev: true, watch});

		await plugins.setup();

		if (!watch) {
			await plugins.teardown();
		}
	},
};
