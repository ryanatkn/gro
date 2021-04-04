import type {Task} from './task/task.js';
import {Filer} from './build/Filer.js';
import {printTiming} from './utils/print.js';
import {Timings} from './utils/time.js';
import {createDefaultBuilder} from './build/defaultBuilder.js';
import {paths, toBuildOutPath, SERVER_BUILD_BASE_PATH, isThisProjectGro} from './paths.js';
import {createGroServer} from './server/server.js';
import type {GroServer} from './server/server.js';
import {GroConfig, loadGroConfig} from './config/config.js';
import {configureLogLevel} from './utils/log.js';
import type {ServedDirPartial} from './build/ServedDir.js';
import {loadHttpsCredentials} from './server/https.js';
import {createRestartableProcess} from './utils/process.js';
import {hasGroServerConfig, SERVER_BUILD_CONFIG_NAME} from './config/defaultBuildConfig.js';
import {callHooks} from './utils/hook.js';

export interface TaskArgs {
	nocert?: boolean;
	certfile: string;
	certkeyfile: string;
	onCreateConfig?: (config: GroConfig) => void;
	onCreateFiler?: (file: Filer, config: GroConfig) => void;
	onCreateServer?: (server: GroServer) => void;
	onInitFiler?: (filer: Filer) => void;
	onStartServer?: (server: GroServer) => void;
	onReady?: (server: GroServer, filer: Filer, config: GroConfig) => void;
}

export const task: Task<TaskArgs> = {
	description: 'start dev server',
	run: async ({dev, log, args}) => {
		const timings = new Timings();

		const timingToLoadConfig = timings.start('load config');
		const config = await loadGroConfig(dev);
		configureLogLevel(config.logLevel);
		timingToLoadConfig();
		callHooks(args, 'onCreateConfig', [config]);

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
		callHooks(args, 'onCreateFiler', [filer, config]);

		// TODO restart functionality
		const timingToCreateGroServer = timings.start('create dev server');
		// TODO write docs and validate args, maybe refactor, see also `serve.task.ts`
		const https = args.nocert
			? null
			: await loadHttpsCredentials(log, args.certfile, args.certkeyfile);
		const server = createGroServer({filer, host: config.host, port: config.port, https});
		timingToCreateGroServer();
		callHooks(args, 'onCreateServer', [server]);

		await Promise.all([
			(async () => {
				const timingToInitFiler = timings.start('init filer');
				await filer.init();
				timingToInitFiler();
				callHooks(args, 'onInitFiler', [filer]);
			})(),
			(async () => {
				const timingToStartGroServer = timings.start('start dev server');
				await server.start();
				timingToStartGroServer();
				callHooks(args, 'onStartServer', [server]);
			})(),
		]);

		callHooks(args, 'onReady', [server, filer, config]);

		// Support the Gro server pattern by default.
		// Normal user projects will hit this code path right here:
		// in other words, `isThisProjectGro` will always be `false` for your code.
		// TODO task pollution, this is bad for users who want to copy/paste this task.
		// think of a better way - maybe config+defaults?
		// I don't want to touch Gro's prod build pipeline right now using package.json `"preversion"`
		if (!isThisProjectGro && hasGroServerConfig(config.builds)) {
			// When `src/server/server.ts` or any of its dependencies change, restart the API server.
			const serverBuildPath = toBuildOutPath(
				true,
				SERVER_BUILD_CONFIG_NAME,
				SERVER_BUILD_BASE_PATH,
			);
			const serverProcess = createRestartableProcess('node', [serverBuildPath]);
			filer.on('build', ({buildConfig}) => {
				if (buildConfig.name === SERVER_BUILD_CONFIG_NAME) {
					serverProcess.restart();
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
