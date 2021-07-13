import {Timings} from '@feltcoop/felt/util/timings.js';
import {print_timings} from '@feltcoop/felt/util/print.js';

import type {Task, Args} from 'src/task/task.js';
import {Task_Error} from './task/task.js';
import type {Map_Input_Options, Map_Output_Options, Map_Watch_Options} from 'src/build/rollup.js';
import {load_config} from './config/config.js';
import type {Gro_Config} from 'src/config/config.js';
import {adapt} from './adapt/adapt.js';
import {build_source} from './build/build_source.js';
import {Plugins} from './plugin/plugin.js';

export interface Task_Args extends Args {
	map_input_options?: Map_Input_Options;
	map_output_options?: Map_Output_Options;
	map_watch_options?: Map_Watch_Options;
}

export interface Task_Events {
	'build.create_config': (config: Gro_Config) => void;
}

export const task: Task<Task_Args, Task_Events> = {
	summary: 'build the project',
	dev: false,
	run: async (ctx): Promise<void> => {
		const {fs, dev, log, events} = ctx;

		if (dev) {
			throw new Task_Error('Task `gro build` cannot be run in development mode');
		}

		const timings = new Timings(); // TODO belongs in ctx

		// TODO delete prod builds (what about config/system tho?)

		const timing_to_load_config = timings.start('load config');
		const config = await load_config(fs, dev);
		timing_to_load_config();
		events.emit('build.create_config', config);

		const plugins = await Plugins.create({...ctx, config, filer: null, timings});

		// Build everything with esbuild and Gro's `Filer` first.
		// These production artifacts are then available to all adapters.
		// There may be no builds, e.g. for SvelteKit-only frontend projects,
		// so just don't build in that case.
		if (config.builds.length) {
			const timing_to_build_source = timings.start('build_source');
			await build_source(fs, config, dev, log);
			timing_to_build_source();
		}

		await plugins.setup();
		await plugins.teardown();

		// Adapt the build to final ouputs.
		const adapters = await adapt({...ctx, config, timings});
		if (!adapters.length) log.info('no adapters to `adapt`');

		print_timings(timings, log);
	},
};
