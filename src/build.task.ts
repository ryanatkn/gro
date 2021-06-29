import {Timings} from '@feltcoop/felt/util/time.js';
import {print_timings} from '@feltcoop/felt/util/print.js';
import {to_array} from '@feltcoop/felt/util/array.js';

import type {Task, Args} from './task/task.js';
import type {Map_Input_Options, Map_Output_Options, Map_Watch_Options} from './build/rollup.js';
import {load_config} from './config/config.js';
import type {Gro_Config} from './config/config.js';
import type {Task_Events as Server_Task_Events} from './server.task.js';
import type {Adapter_Context, Adapter} from './adapt/adapter.js';
import {build_source} from './build/build_source.js';
import type {Plugin, Plugin_Context} from './plugin/plugin.js';

export interface Task_Args extends Args {
	map_input_options?: Map_Input_Options;
	map_output_options?: Map_Output_Options;
	map_watch_options?: Map_Watch_Options;
}

export interface Task_Events extends Server_Task_Events {
	'build.create_config': (config: Gro_Config) => void;
	'build.build_src': void;
}

export const task: Task<Task_Args, Task_Events> = {
	summary: 'build the project',
	dev: false,
	run: async (ctx): Promise<void> => {
		const {fs, dev, log, events} = ctx;
		if (dev) {
			log.warn('building in development mode; normally this is only for diagnostics');
		}

		const timings = new Timings(); // TODO belongs in ctx

		const timing_to_load_config = timings.start('load config');
		const config = await load_config(fs, dev);
		timing_to_load_config();
		events.emit('build.create_config', config);

		// Create the production plugins
		// TODO this has a lot of copypaste with `gro dev` plugin usage,
		// probably extract a common interface
		const timing_to_create_plugins = timings.start('create plugins');
		const plugin_context: Plugin_Context<Task_Args, Task_Events> = {
			...ctx,
			config,
		};
		const plugins: Plugin<any, any>[] = to_array(await config.plugin(plugin_context)).filter(
			Boolean,
		) as Plugin<any, any>[];
		timing_to_create_plugins();

		// Build everything with esbuild and Gro's `Filer` first.
		// These production artifacts are then available to all adapters.
		const timing_to_build_src = timings.start('build_src');
		await build_source(fs, config, dev, log);
		timing_to_build_src();
		events.emit('build.build_src');

		const timing_to_call_plugin_setup = timings.start('setup plugins');
		for (const plugin of plugins) {
			if (!plugin.setup) continue;
			const timing = timings.start(`setup:${plugin.name}`);
			await plugin.setup(plugin_context);
			timing();
		}
		timing_to_call_plugin_setup();

		const timing_to_call_plugin_teardown = timings.start('teardown plugins');
		for (const plugin of plugins) {
			if (!plugin.teardown) continue;
			const timing = timings.start(`teardown:${plugin.name}`);
			await plugin.teardown(plugin_context);
			timing();
		}
		timing_to_call_plugin_teardown();

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
			const timing_to_call_adapt = timings.start('adapt');
			for (const adapter of adapters) {
				if (!adapter.adapt) continue;
				const timing = timings.start(`adapt:${adapter.name}`);
				await adapter.adapt(adapt_context);
				timing();
			}
			timing_to_call_adapt();
		} else {
			log.info('no adapters to `adapt`');
		}

		print_timings(timings, log);
	},
};
