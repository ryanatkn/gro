import {print_timings} from '@feltcoop/felt/util/print.js';
import {Timings} from '@feltcoop/felt/util/timings.js';

import type {Task} from 'src/task/task.js';
import {Filer} from './build/Filer.js';
import {gro_builder_default} from './build/gro_builder_default.js';
import {paths, to_build_out_path} from './paths.js';
import type {GroConfig} from 'src/config/config.js';
import {load_config} from './config/config.js';
import type {ServedDirPartial} from 'src/build/served_dir.js';
import type {PluginContext} from './plugin/plugin.js';
import {Plugins} from './plugin/plugin.js';
import type {DevServerPluginContext} from 'src/plugin/gro_plugin_dev_server.js';

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
	'dev.create_config': (config: GroConfig) => void;
	'dev.create_filer': (filer: Filer) => void;
	'dev.create_context': (ctx: DevTaskContext) => void;
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

		const timing_to_load_config = timings.start('load config');
		const config = await load_config(fs, dev);
		timing_to_load_config();
		events.emit('dev.create_config', config);

		const timing_to_create_filer = timings.start('create filer');
		const filer = new Filer({
			fs,
			dev,
			builder: gro_builder_default(),
			source_dirs: [paths.source],
			served_dirs: config.serve || to_default_served_dirs(config),
			build_configs: config.builds,
			target: config.target,
			sourcemap: config.sourcemap,
			watch,
		});
		timing_to_create_filer();
		events.emit('dev.create_filer', filer);

		const init_filer = async (): Promise<void> => {
			const timing_to_init_filer = timings.start('init filer');
			await filer.init();
			timing_to_init_filer();
		};

		const dev_task_context: DevTaskContext = {...ctx, config, filer, timings};
		events.emit('dev.create_context', dev_task_context);

		const plugins = await Plugins.create(dev_task_context);

		await init_filer();

		await plugins.setup();

		events.emit('dev.ready', dev_task_context);

		if (!watch) {
			await plugins.teardown();
		}

		print_timings(timings, log);
	},
};

// TODO rework this when we change the deprecated frontend build process
const to_default_served_dirs = (config: GroConfig): ServedDirPartial[] | undefined => {
	const build_config_to_serve = config.primary_browser_build_config;
	if (!build_config_to_serve) return undefined;
	const build_out_dir_to_serve = to_build_out_path(true, build_config_to_serve.name, '');
	return [build_out_dir_to_serve];
};
