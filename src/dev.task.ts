import {print_timings} from '@feltcoop/felt/util/print.js';
import {Timings} from '@feltcoop/felt/util/time.js';
import {create_restartable_process} from '@feltcoop/felt/util/process.js';
import {to_array} from '@feltcoop/felt/util/array.js';

import type {Task} from './task/task.js';
import {Filer} from './build/Filer.js';
import {create_default_builder} from './build/default_builder.js';
import {paths, to_build_out_path, is_this_project_gro} from './paths.js';
import {create_gro_server} from './server/server.js';
import type {Gro_Server} from './server/server.js';
import type {Gro_Config} from './config/config.js';
import {load_config} from './config/config.js';
import type {Served_Dir_Partial} from './build/served_dir.js';
import {load_https_credentials} from './server/https.js';
import {
	has_api_server_config,
	API_SERVER_BUILD_BASE_PATH,
	API_SERVER_BUILD_NAME,
} from './build/default_build_config.js';
import type {Plugin, Plugin_Context} from './plugin/plugin.js';

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
	'dev.init_filer': (ctx: Dev_Task_Context) => void;
	'dev.start_server': (ctx: Dev_Task_Context) => void;
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

		// Create the dev plugins
		const timing_to_create_plugins = timings.start('create plugins');
		const plugin_context: Plugin_Context<Task_Args, Task_Events> = {
			...ctx,
			config,
		};
		const plugins: Plugin<any, any>[] = to_array(await config.plugin(plugin_context)).filter(
			Boolean,
		) as Plugin<any, any>[];
		timing_to_create_plugins();

		const timing_to_create_filer = timings.start('create filer');
		const filer = new Filer({
			fs,
			dev,
			builder: create_default_builder(),
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

		const timing_to_call_plugin_setup = timings.start('setup plugins');
		for (const plugin of plugins) {
			if (!plugin.setup) continue;
			const timing = timings.start(`setup:${plugin.name}`);
			await plugin.setup(plugin_context);
			timing();
		}
		timing_to_call_plugin_setup();

		const teardown_plugins = async (): Promise<void> => {
			const timing_to_call_plugin_teardown = timings.start('teardown plugins');
			for (const plugin of plugins) {
				if (!plugin.teardown) continue;
				const timing = timings.start(`teardown:${plugin.name}`);
				await plugin.teardown(plugin_context);
				timing();
			}
			timing_to_call_plugin_teardown();
		};

		// exit early if we're not in watch mode
		// TODO this is a bit janky because events behave differently
		if (!watch) {
			await init_filer();
			print_timings(timings, log);
			await teardown_plugins();
			return;
		}

		// TODO restart functionality
		const timing_to_create_gro_server = timings.start('create dev server');
		// TODO write docs and validate args, maybe refactor, see also `serve.task.ts`
		const https = args.insecure
			? null
			: await load_https_credentials(fs, log, args.cert, args.certkey);
		const server = create_gro_server({filer, host: config.host, port: config.port, https});
		timing_to_create_gro_server();
		events.emit('dev.create_server', server);

		const dev_task_context: Dev_Task_Context = {config, server, filer};

		await Promise.all([
			(async (): Promise<void> => {
				await init_filer();
				events.emit('dev.init_filer', dev_task_context);
			})(),
			(async (): Promise<void> => {
				const timing_to_start_gro_server = timings.start('start dev server');
				await server.start();
				timing_to_start_gro_server();
				events.emit('dev.start_server', dev_task_context);
			})(),
		]);

		events.emit('dev.ready', dev_task_context);

		// TODO move this to the adapter

		// Support the API server pattern by default.
		// Normal user projects will hit this code path right here:
		// in other words, `is_this_project_gro` will always be `false` for your code.
		// TODO task pollution, this is bad for users who want to copy/paste this task.
		// think of a better way - maybe config+defaults?
		// I don't want to touch Gro's prod build pipeline right now using package.json `"preversion"`
		if (!is_this_project_gro && has_api_server_config(config.builds)) {
			// When `src/server/server.ts` or any of its dependencies change, restart the API server.
			const server_build_path = to_build_out_path(
				true,
				API_SERVER_BUILD_NAME,
				API_SERVER_BUILD_BASE_PATH,
			);
			const server_process = create_restartable_process('node', [server_build_path]);
			filer.on('build', ({build_config}) => {
				if (build_config.name === API_SERVER_BUILD_NAME) {
					server_process.restart();
				}
			});
		}

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
