import {print_timings} from '@feltcoop/felt/utils/print.js';
import {Timings} from '@feltcoop/felt/utils/time.js';
import {createRestartableProcess, spawn} from '@feltcoop/felt/utils/process.js';
import type {Spawned_Process} from '@feltcoop/felt/utils/process.js';

import type {Task} from './task/task.js';
import {Filer} from './build/Filer.js';
import {create_default_builder} from './build/default_builder.js';
import {paths, to_build_out_path, is_this_project_gro} from './paths.js';
import {create_gro_server} from './server/server.js';
import type {GroServer} from './server/server.js';
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

export interface DevTask_Context {
	config: Gro_Config;
	filer: Filer;
	server: GroServer;
	sveltekitProcess: Spawned_Process | null;
}

export interface Task_Events {
	'dev.createConfig': (config: Gro_Config) => void;
	'dev.createFiler': (filer: Filer) => void;
	'dev.createServer': (server: GroServer) => void;
	'dev.initFiler': (ctx: DevTask_Context) => void;
	'dev.startServer': (ctx: DevTask_Context) => void;
	'dev.ready': (ctx: DevTask_Context) => void;
}

export const task: Task<Task_Args, Task_Events> = {
	description: 'start dev server',
	run: async ({fs, dev, log, args, events}) => {
		const timings = new Timings();

		// Support SvelteKit builds alongside Gro
		let sveltekitProcess: Spawned_Process | null = null;
		if (await has_sveltekit_frontend(fs)) {
			sveltekitProcess = spawn('npx', ['svelte-kit', 'dev']);
		}

		const timingToLoadConfig = timings.start('load config');
		const config = await load_config(fs, dev);
		timingToLoadConfig();
		events.emit('dev.createConfig', config);

		const timing_to_create_filer = timings.start('create filer');
		const filer = new Filer({
			fs,
			dev,
			builder: create_default_builder(),
			source_dirs: [paths.source],
			served_dirs: config.serve || getDefaultServed_Dirs(config),
			build_configs: config.builds,
			target: config.target,
			sourcemap: config.sourcemap,
		});
		timing_to_create_filer();
		events.emit('dev.createFiler', filer);

		// TODO restart functionality
		const timingToCreateGroServer = timings.start('create dev server');
		// TODO write docs and validate args, maybe refactor, see also `serve.task.ts`
		const https = args.nocert
			? null
			: await load_https_credentials(fs, log, args.certfile, args.certkeyfile);
		const server = create_gro_server({filer, host: config.host, port: config.port, https});
		timingToCreateGroServer();
		events.emit('dev.createServer', server);

		const devTask_Context: DevTask_Context = {config, server, filer, sveltekitProcess};

		await Promise.all([
			(async () => {
				const timingToInitFiler = timings.start('init filer');
				await filer.init();
				timingToInitFiler();
				events.emit('dev.initFiler', devTask_Context);
			})(),
			(async () => {
				const timingToStartGroServer = timings.start('start dev server');
				await server.start();
				timingToStartGroServer();
				events.emit('dev.startServer', devTask_Context);
			})(),
		]);

		events.emit('dev.ready', devTask_Context);

		// Support the API server pattern by default.
		// Normal user projects will hit this code path right here:
		// in other words, `is_this_project_gro` will always be `false` for your code.
		// TODO task pollution, this is bad for users who want to copy/paste this task.
		// think of a better way - maybe config+defaults?
		// I don't want to touch Gro's prod build pipeline right now using package.json `"preversion"`
		if (!is_this_project_gro && has_api_server_config(config.builds)) {
			// When `src/server/server.ts` or any of its dependencies change, restart the API server.
			const serverBuildPath = to_build_out_path(
				true,
				API_SERVER_BUILD_NAME,
				API_SERVER_BUILD_BASE_PATH,
			);
			const serverProcess = createRestartableProcess('node', [serverBuildPath]);
			filer.on('build', ({build_config}) => {
				if (build_config.name === API_SERVER_BUILD_NAME) {
					serverProcess.restart();
				}
			});
		}

		print_timings(timings, log);
	},
};

const getDefaultServed_Dirs = (config: Gro_Config): Served_Dir_Partial[] => {
	const build_config_to_serve = config.primary_browser_build_config ?? config.system_build_config;
	const build_out_dir_to_serve = to_build_out_path(true, build_config_to_serve.name, '');
	return [build_out_dir_to_serve];
};
