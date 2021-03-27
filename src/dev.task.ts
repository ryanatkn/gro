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

export const task: Task = {
	description: 'start dev server',
	run: async ({log, args}) => {
		const timings = new Timings();

		const timingToLoadConfig = timings.start('load config');
		const config = await loadGroConfig();
		configureLogLevel(config.logLevel);
		timingToLoadConfig();

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

		const timingToCreateDevServer = timings.start('create dev server');
		// TODO write docs and validate args, maybe refactor, see also `serve.task.ts`
		const https = args.nocert
			? null
			: await loadHttpsCredentials(log, args.certfile as string, args.certkeyfile as string);
		const server = createDevServer({filer, host: config.host, port: config.port, https});
		timingToCreateDevServer();

		await Promise.all([
			(async () => {
				const timingToInitFiler = timings.start('init filer');
				await filer.init();
				timingToInitFiler();
			})(),
			(async () => {
				const timingToStartDevServer = timings.start('start dev server');
				await server.start();
				timingToStartDevServer();
			})(),
		]);

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
