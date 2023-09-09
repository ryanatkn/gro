import {printTimings} from '@feltjs/util/print.js';
import {Timings} from '@feltjs/util/timings.js';
import {z} from 'zod';

import type {Task} from './task/task.js';
import {Filer} from './build/Filer.js';
import {gro_builder_default} from './build/gro_builder_default.js';
import {paths} from './path/paths.js';
import {load_config, type GroConfig} from './config/config.js';
import {Plugins, type PluginContext} from './plugin/plugin.js';

export interface TaskEvents {
	'dev.create_config': (config: GroConfig) => void;
	'dev.create_filer': (filer: Filer) => void;
	'dev.create_context': (ctx: DevTaskContext) => void;
	'dev.ready': (ctx: DevTaskContext) => void;
}

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

export type DevTaskContext = PluginContext<Args, TaskEvents>;

export const task: Task<Args, TaskEvents> = {
	summary: 'start SvelteKit and other dev plugins',
	Args,
	run: async (ctx) => {
		const {log, args, events, invoke_task} = ctx;
		const {watch} = args;

		const timings = new Timings();

		await invoke_task('gen');

		const timing_to_load_config = timings.start('load config');
		const config = await load_config();
		timing_to_load_config();
		events.emit('dev.create_config', config);

		const timing_to_create_filer = timings.start('create filer');
		const filer = new Filer({
			dev: true,
			builder: gro_builder_default(),
			source_dirs: [paths.source],
			build_configs: config.builds,
			target: config.target,
			sourcemap: config.sourcemap,
			watch,
		});
		console.log('CREATED FILER');
		timing_to_create_filer();
		events.emit('dev.create_filer', filer);

		const dev_task_context: DevTaskContext = {...ctx, config, dev: true, filer, timings};
		events.emit('dev.create_context', dev_task_context);

		console.log('CREATING PLUGINS');
		const plugins = await Plugins.create(dev_task_context);

		const timing_to_init_filer = timings.start('init filer');
		console.log('INIT FILER');
		await filer.init();
		timing_to_init_filer();

		console.log('SETTING UP PLUGINS');
		await plugins.setup();

		events.emit('dev.ready', dev_task_context);

		if (!watch) {
			await plugins.teardown(); // maybe detect process exit and teardown
		}

		printTimings(timings, log);
	},
};
