import {Timings} from '@feltcoop/felt/util/timings.js';
import {print_timings} from '@feltcoop/felt/util/print.js';

import type {Task} from 'src/task/task.js';
import type {MapInputOptions, MapOutputOptions, MapWatchOptions} from 'src/build/rollup.js';
import {load_config} from './config/config.js';
import type {GroConfig} from 'src/config/config.js';
import {adapt} from './adapt/adapt.js';
import {build_source} from './build/build_source.js';
import {Plugins} from './plugin/plugin.js';
import {clean_fs} from './fs/clean.js';

export interface TaskArgs {
	clean?: boolean;
	'no-clean'?: boolean;
	map_input_options?: MapInputOptions;
	map_output_options?: MapOutputOptions;
	map_watch_options?: MapWatchOptions;
}

export interface TaskEvents {
	'build.create_config': (config: GroConfig) => void;
}

export const task: Task<TaskArgs, TaskEvents> = {
	summary: 'build the project',
	dev: false,
	run: async (ctx): Promise<void> => {
		const {fs, dev, log, events, args} = ctx;

		const timings = new Timings(); // TODO belongs in ctx

		const {clean = true} = args;

		// Clean in the default case, but not if the caller passes a `false` `clean` arg,
		// This is used by `gro publish` and `gro deploy` because they call `clean_fs` themselves.
		if (clean) {
			await clean_fs(fs, {build_prod: true}, log);
		}

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
