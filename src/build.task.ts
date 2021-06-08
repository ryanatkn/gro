import {Timings} from '@feltcoop/felt/utils/time.js';
import {print_timings} from '@feltcoop/felt/utils/print.js';
import {toArray} from '@feltcoop/felt/utils/array.js';

import type {Task, Args} from './task/task.js';
import type {Map_Input_Options, Map_Output_Options, Map_Watch_Options} from './build/rollup.js';
import {load_config} from './config/config.js';
import type {Gro_Config} from './config/config.js';
import type {Task_Events as ServerTask_Events} from './server.task.js';
import type {AdapterContext, Adapter} from './adapt/adapter.js';
import {build_source_directory} from './build/build_source_directory.js';
import {generateTypes} from './build/tsBuildHelpers.js';
import {paths, to_types_build_dir} from './paths.js';
import {clean} from './fs/clean.js';

export interface Task_Args extends Args {
	map_input_options?: Map_Input_Options;
	map_output_options?: Map_Output_Options;
	map_watch_options?: Map_Watch_Options;
}

export interface Task_Events extends ServerTask_Events {
	'build.createConfig': (config: Gro_Config) => void;
	'build.buildTypes': void;
	'build.buildSrc': void;
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
		const timingToBuildTypes = timings.start('buildTypes');
		await generateTypes(paths.source, to_types_build_dir(), true);
		timingToBuildTypes();
		events.emit('build.buildTypes');

		const timingToLoadConfig = timings.start('load config');
		const config = await load_config(fs, dev);
		timingToLoadConfig();
		events.emit('build.createConfig', config);

		// Build everything with esbuild and Gro's `Filer` first.
		// These production artifacts are then available to all adapters.
		const timingToBuildSrc = timings.start('buildSrc');
		await build_source_directory(fs, config, dev, log);
		timingToBuildSrc();
		events.emit('build.buildSrc');

		// Adapt the build to final ouputs.
		const timingToCreateAdapters = timings.start('create adapters');
		const adaptContext: AdapterContext<Task_Args, Task_Events> = {
			...ctx,
			config,
		};
		const adapters: Adapter<any, any>[] = toArray(await config.adapt(adaptContext)).filter(
			Boolean,
		) as Adapter<any, any>[];
		timingToCreateAdapters();

		if (adapters.length) {
			const timingToCallBegin = timings.start('begin');
			for (const adapter of adapters) {
				if (!adapter.begin) continue;
				const timing = timings.start(`begin:${adapter.name}`);
				await adapter.begin(adaptContext);
				timing();
			}
			timingToCallBegin();

			const timingToCallAdapt = timings.start('adapt');
			for (const adapter of adapters) {
				if (!adapter.adapt) continue;
				const timing = timings.start(`adapt:${adapter.name}`);
				await adapter.adapt(adaptContext);
				timing();
			}
			timingToCallAdapt();

			const timingToCallEnd = timings.start('end');
			for (const adapter of adapters) {
				if (!adapter.end) continue;
				const timing = timings.start(`end:${adapter.name}`);
				await adapter.end(adaptContext);
				timing();
			}
			timingToCallEnd();
		} else {
			log.info('no adapters to `adapt`');
		}

		print_timings(timings, log);
	},
};
