import {print_timings} from '@feltcoop/felt/util/print.js';
import {Timings} from '@feltcoop/felt/util/timings.js';

import type {Task} from 'src/task/task.js';
import {Filer} from './build/Filer.js';
import {gro_builder_default} from './build/gro_builder_default.js';
import {paths, to_build_out_path} from './paths.js';
import {create_gro_server} from './server/server.js';
import type {Gro_Server} from 'src/server/server.js';
import type {Gro_Config} from 'src/config/config.js';
import {load_config} from './config/config.js';
import type {Served_Dir_Partial} from 'src/build/served_dir.js';
import {load_https_credentials} from './server/https.js';
import {Plugins} from './plugin/plugin.js';

export interface Task_Args {
	watch?: boolean; // defaults to `true`
	'no-watch'?: boolean;
	insecure?: boolean;
	cert?: string;
	certkey?: string;
}

export interface Dev_Task_Context {
	config: Gro_Config;
	filer: Filer;
	server: Gro_Server;
}

export interface Task_Events {
	'dev.create_config': (config: Gro_Config) => void;
	'dev.create_filer': (filer: Filer) => void;
	'dev.create_server': (server: Gro_Server) => void;
	'dev.ready': (ctx: Dev_Task_Context) => void;
}

export const task: Task<Task_Args, Task_Events> = {
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

		const plugins = await Plugins.create({...ctx, config, filer, timings});

		const timing_to_create_gro_server = timings.start('create dev server');
		const https = args.insecure
			? null
			: await load_https_credentials(fs, log, args.cert, args.certkey);
		const server = create_gro_server({filer, host: config.host, port: config.port, https});
		timing_to_create_gro_server();
		events.emit('dev.create_server', server);

		await init_filer();

		await plugins.setup();

		if (watch) {
			const timing_to_start_gro_server = timings.start('start dev server');
			await server.start();
			timing_to_start_gro_server();
		} else {
			await plugins.teardown();
		}

		const dev_task_context: Dev_Task_Context = {config, server, filer};
		events.emit('dev.ready', dev_task_context);

		print_timings(timings, log);
	},
};

// TODO rework this when we change the deprecated frontend build process
const to_default_served_dirs = (config: Gro_Config): Served_Dir_Partial[] | undefined => {
	const build_config_to_serve = config.primary_browser_build_config;
	if (!build_config_to_serve) return undefined;
	const build_out_dir_to_serve = to_build_out_path(true, build_config_to_serve.name, '');
	return [build_out_dir_to_serve];
};
