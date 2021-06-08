import {print_timings} from '@feltcoop/felt/utils/print.js';
import {Timings} from '@feltcoop/felt/utils/time.js';
import {create_restartable_process, spawn} from '@feltcoop/felt/utils/process.js';
import type {Spawned_Process} from '@feltcoop/felt/utils/process.js';

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
	has_sveltekit_frontend,
} from './build/default_build_config.js';

export interface Task_Args {
	nocert?: boolean;
	certfile?: string;
	certkeyfile?: string;
}

export interface Dev_Task_Context {
	config: Gro_Config;
	filer: Filer;
	server: Gro_Server;
	sveltekit_process: Spawned_Process | null;
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
	description: 'start dev server',
	run: async ({fs, dev, log, args, events}) => {
		const timings = new Timings();

		// Support SvelteKit builds alongside Gro
		let sveltekit_process: Spawned_Process | null = null;
		if (await has_sveltekit_frontend(fs)) {
			sveltekit_process = spawn('npx', ['svelte-kit', 'dev']);
		}

		const timing_to_load_config = timings.start('load config');
		const config = await load_config(fs, dev);
		timing_to_load_config();
		events.emit('dev.create_config', config);

		const timing_to_create_filer = timings.start('create filer');
		const filer = new Filer({
			fs,
			dev,
			builder: create_default_builder(),
			source_dirs: [paths.source],
			served_dirs: config.serve || get_default_served_dirs(config),
			build_configs: config.builds,
			target: config.target,
			sourcemap: config.sourcemap,
		});
		timing_to_create_filer();
		events.emit('dev.create_filer', filer);

		// TODO restart functionality
		const timing_to_create_gro_server = timings.start('create dev server');
		// TODO write docs and validate args, maybe refactor, see also `serve.task.ts`
		const https = args.nocert
			? null
			: await load_https_credentials(fs, log, args.certfile, args.certkeyfile);
		const server = create_gro_server({filer, host: config.host, port: config.port, https});
		timing_to_create_gro_server();
		events.emit('dev.create_server', server);

		const dev_task_context: Dev_Task_Context = {config, server, filer, sveltekit_process};

		await Promise.all([
			(async () => {
				const timing_to_init_filer = timings.start('init filer');
				await filer.init();
				timing_to_init_filer();
				events.emit('dev.init_filer', dev_task_context);
			})(),
			(async () => {
				const timing_to_start_gro_server = timings.start('start dev server');
				await server.start();
				timing_to_start_gro_server();
				events.emit('dev.start_server', dev_task_context);
			})(),
		]);

		events.emit('dev.ready', dev_task_context);

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

const get_default_served_dirs = (config: Gro_Config): Served_Dir_Partial[] => {
	const build_config_to_serve = config.primary_browser_build_config ?? config.system_build_config;
	const build_out_dir_to_serve = to_build_out_path(true, build_config_to_serve.name, '');
	return [build_out_dir_to_serve];
};
