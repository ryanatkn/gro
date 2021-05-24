import type {Task, Args} from './task/task.js';
import type {MapInputOptions, MapOutputOptions, MapWatchOptions} from './build/rollup.js';
import {Timings} from './utils/time.js';
import {loadGroConfig} from './config/config.js';
import type {GroConfig} from './config/config.js';
import type {TaskEvents as ServerTaskEvents} from './server.task.js';
import {printTimings} from './utils/print.js';
import {toArray} from './utils/array.js';
import type {AdapterContext, Adapter} from './adapt/adapter.js';
import {buildSourceDirectory} from './build/buildSourceDirectory.js';
import {generateTypes} from './build/tsBuildHelpers.js';
import {paths, toTypesBuildDir} from './paths.js';
import {clean} from './fs/clean.js';

// outputs build artifacts to dist/ using SvelteKit or Gro config

export interface TaskArgs extends Args {
	mapInputOptions?: MapInputOptions;
	mapOutputOptions?: MapOutputOptions;
	mapWatchOptions?: MapWatchOptions;
}

export interface TaskEvents extends ServerTaskEvents {
	'build.createConfig': (config: GroConfig) => void;
	'build.buildTypes': void;
	'build.buildSrc': void;
}

export const task: Task<TaskArgs, TaskEvents> = {
	description: 'build the project',
	dev: false,
	run: async (ctx): Promise<void> => {
		const {fs, dev, log, events} = ctx;
		if (dev) {
			log.warn('building in development mode; normally this is only for diagnostics');
		}

		const timings = new Timings(); // TODO belongs in ctx

		// TODO properly clean
		await clean(fs, {dist: true}, log);

		// Build all types so they're available.
		// TODO refactor? maybe lazily build types only when a builder wants them
		const timingToBuildTypes = timings.start('buildTypes');
		await generateTypes(paths.source, toTypesBuildDir(), true);
		timingToBuildTypes();
		events.emit('build.buildTypes');

		const timingToLoadConfig = timings.start('load config');
		const config = await loadGroConfig(fs, dev);
		timingToLoadConfig();
		events.emit('build.createConfig', config);

		// Build everything with esbuild and Gro's `Filer` first.
		// These production artifacts are then available to all adapters.
		const timingToBuildSrc = timings.start('buildSrc');
		await buildSourceDirectory(fs, config, dev, log);
		timingToBuildSrc();
		events.emit('build.buildSrc');

		// Adapt the build to final ouputs.
		const timingToCreateAdapters = timings.start('create adapters');
		const adaptContext: AdapterContext<TaskArgs, TaskEvents> = {
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

		printTimings(timings, log);
	},
};
