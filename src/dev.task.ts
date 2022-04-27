import {printTimings} from '@feltcoop/felt/util/print.js';
import {Timings} from '@feltcoop/felt/util/timings.js';

import type {Task} from './task/task.js';
import {Filer} from './build/Filer.js';
import {groBuilderDefault} from './build/groBuilderDefault.js';
import {paths} from './paths.js';
import {loadConfig, type GroConfig} from './config/config.js';
import {Plugins, type PluginContext} from './plugin/plugin.js';
import type {DevTaskArgs} from './devTask.js';
import {DevTaskArgsSchema} from './devTask.schema.js';

export type DevTaskContext = PluginContext<DevTaskArgs, TaskEvents>;

export interface TaskEvents {
	'dev.createConfig': (config: GroConfig) => void;
	'dev.createFiler': (filer: Filer) => void;
	'dev.createContext': (ctx: DevTaskContext) => void;
	'dev.ready': (ctx: DevTaskContext) => void;
}

export const task: Task<DevTaskArgs, TaskEvents> = {
	summary: 'start SvelteKit and other dev plugins',
	args: DevTaskArgsSchema,
	run: async (ctx) => {
		const {fs, dev, log, args, events} = ctx;
		const {watch} = args;

		const timings = new Timings();

		const timingToLoadConfig = timings.start('load config');
		const config = await loadConfig(fs, dev);
		timingToLoadConfig();
		events.emit('dev.createConfig', config);

		const timingToCreateFiler = timings.start('create filer');
		const filer = new Filer({
			fs,
			dev,
			builder: groBuilderDefault(),
			sourceDirs: [paths.source],
			buildConfigs: config.builds,
			target: config.target,
			sourcemap: config.sourcemap,
			watch,
		});
		timingToCreateFiler();
		events.emit('dev.createFiler', filer);

		const devTaskContext: DevTaskContext = {...ctx, config, filer, timings};
		events.emit('dev.createContext', devTaskContext);

		const plugins = await Plugins.create(devTaskContext);

		const timingToInitFiler = timings.start('init filer');
		await filer.init();
		timingToInitFiler();

		await plugins.setup();

		events.emit('dev.ready', devTaskContext);

		if (!watch) {
			await plugins.teardown();
		}

		printTimings(timings, log);
	},
};
