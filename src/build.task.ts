import {Timings} from '@feltcoop/felt/util/time.js';
import {print_timings} from '@feltcoop/felt/util/print.js';
import {to_array} from '@feltcoop/felt/util/array.js';

import type {Task, Args} from './task/task.js';
import type {Map_Input_Options, Map_Output_Options, Map_Watch_Options} from './build/rollup.js';
import {load_config} from './config/config.js';
import type {Gro_Config} from './config/config.js';
import type {Task_Events as Server_Task_Events} from './server.task.js';
import type {Adapter_Context, Adapter} from './adapt/adapter.js';
import {build_source_directory} from './build/build_source_directory.js';
import {generate_types} from './build/ts_build_helpers.js';
import {paths, to_types_build_dir} from './paths.js';
import {clean} from './fs/clean.js';

export interface Task_Args extends Args {
	map_input_options?: Map_Input_Options;
	map_output_options?: Map_Output_Options;
	map_watch_options?: Map_Watch_Options;
}

export interface Task_Events extends Server_Task_Events {
	'build.create_config': (config: Gro_Config) => void;
	'build.build_types': void;
	'build.build_src': void;
}

export const task: Task<Task_Args, Task_Events> = {
	description: 'build the project',
	dev: false,
	run: async (ctx): Promise<void> => {
		const {fs, dev, log, events} = ctx;
		if (dev) {
			log.warn('building in development mode; normally this is only for diagnostics');
		}

		const timings = new Timings(); // TODO belongs in ctx

		await clean(fs, {build_prod: true}, log);

		// Build all types so they're available.
		// TODO refactor? maybe lazily build types only when a builder wants them
		const timing_to_build_types = timings.start('build_types');
		await generate_types(paths.source, to_types_build_dir(), true);
		timing_to_build_types();
		events.emit('build.build_types');

		const timing_to_load_config = timings.start('load config');
		const config = await load_config(fs, dev);
		timing_to_load_config();
		events.emit('build.create_config', config);

		// Build everything with esbuild and Gro's `Filer` first.
		// These production artifacts are then available to all adapters.
		const timing_to_build_src = timings.start('build_src');
		await build_source_directory(fs, config, dev, log);
		timing_to_build_src();
		events.emit('build.build_src');

		// Adapt the build to final ouputs.
		const timing_to_create_adapters = timings.start('create adapters');
		const adapt_context: Adapter_Context<Task_Args, Task_Events> = {
			...ctx,
			config,
		};
		const adapters: Adapter<any, any>[] = to_array(await config.adapt(adapt_context)).filter(
			Boolean,
		) as Adapter<any, any>[];
		timing_to_create_adapters();

		if (adapters.length) {
			const timing_to_call_begin = timings.start('begin');
			for (const adapter of adapters) {
				if (!adapter.begin) continue;
				const timing = timings.start(`begin:${adapter.name}`);
				await adapter.begin(adapt_context);
				timing();
			}
			timing_to_call_begin();

			const timing_to_call_adapt = timings.start('adapt');
			for (const adapter of adapters) {
				if (!adapter.adapt) continue;
				const timing = timings.start(`adapt:${adapter.name}`);
				await adapter.adapt(adapt_context);
				timing();
			}
			timing_to_call_adapt();

			const timing_to_call_end = timings.start('end');
			for (const adapter of adapters) {
				if (!adapter.end) continue;
				const timing = timings.start(`end:${adapter.name}`);
				await adapter.end(adapt_context);
				timing();
			}
			timing_to_call_end();
		} else {
			log.info('no adapters to `adapt`');
		}

		print_timings(timings, log);
	},
};
