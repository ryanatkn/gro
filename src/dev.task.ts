import {spawn, ChildProcess} from 'child_process';

import type {Task} from './task/task.js';
import {Filer} from './build/Filer.js';
import {printTiming} from './utils/print.js';
import {Timings} from './utils/time.js';
import {createDefaultBuilder} from './build/defaultBuilder.js';
import {paths, toBuildOutPath} from './paths.js';
import {createDevServer} from './server/server.js';
import {GroConfig, loadGroConfig} from './config/config.js';
import {configureLogLevel} from './utils/log.js';
import type {ServedDirPartial} from './build/ServedDir.js';
import {loadHttpsCredentials} from './server/https.js';
import {hasGroServer} from './config/gro.config.default.js';
import {DEFAULT_BUILD_CONFIG_NAME} from './config/defaultBuildConfig.js';

export const task: Task = {
	description: 'start dev server',
	run: async ({log, args}) => {
		// TODO handle these properly
		// args.oncreateconfig
		// args.oncreatefiler
		// args.oncreateserver
		// args.oninitfiler
		// args.onstartserver
		// args.onready
		const timings = new Timings();

		const timingToLoadConfig = timings.start('load config');
		const config = await loadGroConfig();
		configureLogLevel(config.logLevel);
		timingToLoadConfig();
		args.oncreateconfig && (args as any).oncreateconfig(config);

		const timingToCreateFiler = timings.start('create filer');
		const filer = new Filer({
			builder: createDefaultBuilder(),
			sourceDirs: [paths.source],
			servedDirs: config.serve || getDefaultServedDirs(config),
			buildConfigs: config.builds,
			target: config.target,
			sourcemap: config.sourcemap,
		});
		timingToCreateFiler();
		args.oncreatefiler && (args as any).oncreatefiler(filer);

		const timingToCreateDevServer = timings.start('create dev server');
		// TODO write docs and validate args, maybe refactor, see also `serve.task.ts`
		const https = args.nocert
			? null
			: await loadHttpsCredentials(log, args.certfile as string, args.certkeyfile as string);
		const server = createDevServer({filer, host: config.host, port: config.port, https});
		timingToCreateDevServer();
		args.oncreateserver && (args as any).oncreateserver(server);

		await Promise.all([
			(async () => {
				const timingToInitFiler = timings.start('init filer');
				await filer.init();
				timingToInitFiler();
				args.oninitfiler && (args as any).oninitfiler(filer);
			})(),
			(async () => {
				const timingToStartDevServer = timings.start('start dev server');
				await server.start();
				timingToStartDevServer();
				args.onstartserver && (args as any).onstartserver(server);
			})(),
		]);

		args.onready && (args as any).onready(filer, server);

		// Support the Gro server pattern by default.
		// TODO make this more reusable
		if (await hasGroServer()) {
			// the API server process: kill'd and restarted every time a dependency changes
			let serverProcess: ChildProcess | null = null;
			let serverClosed: Promise<void> | null = null; // `kill` is sync; this resolves when it's done
			const serverPath = toBuildOutPath(true, DEFAULT_BUILD_CONFIG_NAME, 'server/server.js');
			const restartServer = async (): Promise<void> => {
				if (serverClosed) {
					if (serverProcess) {
						serverProcess.kill();
						serverProcess = null;
					}
					await serverClosed;
				}
				serverProcess = spawn('node', [serverPath], {stdio: 'inherit'});
				let resolve: () => void;
				serverClosed = new Promise((r) => (resolve = r));
				// TODO handle errors
				serverProcess.on('close', () => {
					resolve();
				});
			};

			// When `src/server/server.ts` or any of its dependencies change, restart the API server.
			restartServer(); // start on init
			filer.on('build', ({buildConfig}) => {
				// TODO to avoid false positives, probably split apart the default Node and server builds.
				// Without more granular detection, the API server will restart
				// when files like this dev task change. That's fine, but it's not nice.
				if (buildConfig.name === DEFAULT_BUILD_CONFIG_NAME) {
					// TODO throttle
					restartServer();
				}
			});
		}

		for (const [key, timing] of timings.getAll()) {
			log.trace(printTiming(key, timing));
		}
	},
};

const getDefaultServedDirs = (config: GroConfig): ServedDirPartial[] => {
	const buildConfigToServe = config.primaryBrowserBuildConfig ?? config.primaryNodeBuildConfig;
	const buildOutDirToServe = toBuildOutPath(true, buildConfigToServe.name, '');
	return [buildOutDirToServe];
};
