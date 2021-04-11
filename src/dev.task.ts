import type {Task} from './task/task.js';
import {Filer} from './build/Filer.js';
import {printTiming} from './utils/print.js';
import {Timings} from './utils/time.js';
import {createDefaultBuilder} from './build/defaultBuilder.js';
import {paths, toBuildOutPath, isThisProjectGro} from './paths.js';
import {createGroServer} from './server/server.js';
import type {GroServer} from './server/server.js';
import type {GroConfig} from './config/config.js';
import {loadGroConfig} from './config/config.js';
import type {ServedDirPartial} from './build/ServedDir.js';
import {loadHttpsCredentials} from './server/https.js';
import {createRestartableProcess, spawn} from './utils/process.js';
import type {SpawnedProcess} from './utils/process.js';
import {
	hasApiServerConfig,
	API_SERVER_BUILD_BASE_PATH,
	API_SERVER_BUILD_CONFIG_NAME,
	hasSvelteKitFrontend,
} from './config/defaultBuildConfig.js';

export interface TaskArgs {
	nocert?: boolean;
	certfile?: string;
	certkeyfile?: string;
}

export interface DevTaskContext {
	config: GroConfig;
	filer: Filer;
	server: GroServer;
	svelteKitProcess: SpawnedProcess | null;
}

export interface TaskEvents {
	'dev.createConfig': (config: GroConfig) => void;
	'dev.createFiler': (filer: Filer) => void;
	'dev.createServer': (server: GroServer) => void;
	'dev.initFiler': (ctx: DevTaskContext) => void;
	'dev.startServer': (ctx: DevTaskContext) => void;
	'dev.ready': (ctx: DevTaskContext) => void;
}

export const task: Task<TaskArgs, TaskEvents> = {
	description: 'start dev server',
	run: async ({fs, dev, log, args, events}) => {
		const timings = new Timings();

		// Support SvelteKit builds alongside Gro
		let svelteKitProcess: SpawnedProcess | null = null;
		if (await hasSvelteKitFrontend(fs)) {
			svelteKitProcess = spawn('npx', ['svelte-kit', 'dev']);
		}

		const timingToLoadConfig = timings.start('load config');
		const config = await loadGroConfig(fs, dev);
		timingToLoadConfig();
		events.emit('dev.createConfig', config);

		const timingToCreateFiler = timings.start('create filer');
		const filer = new Filer({
			fs,
			dev,
			builder: createDefaultBuilder(),
			sourceDirs: [paths.source],
			servedDirs: config.serve || getDefaultServedDirs(config),
			buildConfigs: config.builds,
			target: config.target,
			sourcemap: config.sourcemap,
		});
		timingToCreateFiler();
		events.emit('dev.createFiler', filer);

		// TODO restart functionality
		const timingToCreateGroServer = timings.start('create dev server');
		// TODO write docs and validate args, maybe refactor, see also `serve.task.ts`
		const https = args.nocert
			? null
			: await loadHttpsCredentials(fs, log, args.certfile, args.certkeyfile);
		const server = createGroServer({filer, host: config.host, port: config.port, https});
		timingToCreateGroServer();
		events.emit('dev.createServer', server);

		const devTaskContext: DevTaskContext = {config, server, filer, svelteKitProcess};

		await Promise.all([
			(async () => {
				const timingToInitFiler = timings.start('init filer');
				await filer.init();
				timingToInitFiler();
				events.emit('dev.initFiler', devTaskContext);
			})(),
			(async () => {
				const timingToStartGroServer = timings.start('start dev server');
				await server.start();
				timingToStartGroServer();
				events.emit('dev.startServer', devTaskContext);
			})(),
		]);

		events.emit('dev.ready', devTaskContext);

		// Support the API server pattern by default.
		// Normal user projects will hit this code path right here:
		// in other words, `isThisProjectGro` will always be `false` for your code.
		// TODO task pollution, this is bad for users who want to copy/paste this task.
		// think of a better way - maybe config+defaults?
		// I don't want to touch Gro's prod build pipeline right now using package.json `"preversion"`
		if (!isThisProjectGro && hasApiServerConfig(config.builds)) {
			// When `src/server/server.ts` or any of its dependencies change, restart the API server.
			const serverBuildPath = toBuildOutPath(
				true,
				API_SERVER_BUILD_CONFIG_NAME,
				API_SERVER_BUILD_BASE_PATH,
			);
			const serverProcess = createRestartableProcess('node', [serverBuildPath]);
			filer.on('build', ({buildConfig}) => {
				if (buildConfig.name === API_SERVER_BUILD_CONFIG_NAME) {
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
