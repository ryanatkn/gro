import {printTimings} from '@feltcoop/felt/util/print.js';
import {Timings} from '@feltcoop/felt/util/timings.js';

import {type Task} from './task/task.js';
import {Filer} from './build/Filer.js';
import {groBuilderDefault} from './build/groBuilderDefault.js';
import {paths, toBuildOutPath} from './paths.js';
import {loadConfig, type GroConfig} from './config/config.js';
import {type ServedDirPartial} from './build/servedDir.js';
import {Plugins, type PluginContext} from './plugin/plugin.js';
import {type DevServerPluginContext} from './plugin/groPluginDevServer.js';

export interface TaskArgs {
	watch?: boolean; // defaults to `true`
	'no-watch'?: boolean; // CLI arg to set `watch: false` -- internally, refer to `watch` not this
	insecure?: boolean;
	cert?: string;
	certkey?: string;
}

export interface DevTaskContext
	extends DevServerPluginContext,
		PluginContext<TaskArgs, TaskEvents> {}

export interface TaskEvents {
	'dev.createConfig': (config: GroConfig) => void;
	'dev.createFiler': (filer: Filer) => void;
	'dev.createContext': (ctx: DevTaskContext) => void;
	'dev.ready': (ctx: DevTaskContext) => void;
}

export const task: Task<TaskArgs, TaskEvents> = {
	summary: 'start dev server',
	run: async (ctx) => {
		const {fs, dev, log, args, events} = ctx;

		// Mutate `args` with the resolved `watch` value so plugins can use it.
		if (args.watch === undefined) {
			args.watch = true;
		}
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
			servedDirs: config.serve || toDefaultServedDirs(config),
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

// TODO rework this when we change the deprecated frontend build process
const toDefaultServedDirs = (config: GroConfig): ServedDirPartial[] | undefined => {
	const buildConfigToServe = config.primaryBrowserBuildConfig;
	if (!buildConfigToServe) return undefined;
	const buildOutDirToServe = toBuildOutPath(true, buildConfigToServe.name, '');
	return [buildOutDirToServe];
};
