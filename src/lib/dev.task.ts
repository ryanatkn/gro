import {z} from 'zod';

import type {Task} from './task/task.js';
import {Plugins, type PluginContext} from './plugin/plugin.js';

export const Args = z
	.object({
		watch: z.boolean({description: 'read this instead of no-watch'}).default(true),
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

		// TODO BLOCK the server plugin infers `watch` based on `dev` here, should be explicitly a prop

		console.log('CREATING PLUGINS');
		const plugins = await Plugins.create({...ctx, dev: true, watch});

		console.log('SETTING UP PLUGINS');
		await plugins.setup();
		console.log('PLUGINS DONE SETTING UP');

		if (!watch) {
			await plugins.teardown(); // maybe detect process exit and teardown
		}
	},
};
