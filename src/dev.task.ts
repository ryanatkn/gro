import type {Task} from './task/task.js';
import {Filer} from './build/Filer.js';
import {printTiming} from './utils/print.js';
import {Timings} from './utils/time.js';
import {createDefaultBuilder} from './build/defaultBuilder.js';
import {paths, toBuildOutPath, SERVER_BUILD_BASE_PATH, isThisProjectGro} from './paths.js';
import {createDevServer} from './server/server.js';
import {GroConfig, loadGroConfig} from './config/config.js';
import {configureLogLevel} from './utils/log.js';
import type {ServedDirPartial} from './build/ServedDir.js';
import {loadHttpsCredentials} from './server/https.js';
import {createRestartableProcess} from './utils/process.js';
import {hasGroServerConfig, SERVER_BUILD_CONFIG_NAME} from './config/defaultBuildConfig.js';

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

		// TODO restart functionality
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
