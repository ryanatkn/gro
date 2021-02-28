import {Task} from './task/task.js';
import {Filer} from './build/Filer.js';
import {printTiming} from './utils/print.js';
import {Timings} from './utils/time.js';
import {createDefaultBuilder} from './build/defaultBuilder.js';
import {paths, toBuildOutPath} from './paths.js';
import {createDevServer} from './server/server.js';
import {GroConfig, loadGroConfig} from './config/config.js';
import {configureLogLevel} from './utils/log.js';
import {ServedDirPartial} from './build/ServedDir.js';

export const task: Task = {
	description: 'build typescript in watch mode for development',
	run: async ({log}) => {
		const timings = new Timings();

		const timingToLoadConfig = timings.start('load config');
		const config = await loadGroConfig();
		configureLogLevel(config.logLevel);
		timingToLoadConfig();

		const timingToCreateFiler = timings.start('create filer');
		const filer = new Filer({
			builder: await createDefaultBuilder(),
			sourceDirs: [paths.source],
			servedDirs: config.servedDirs || getDefaultServedDirs(config),
			buildConfigs: config.builds,
			target: config.target,
			sourceMap: config.sourceMap,
		});
		timingToCreateFiler();

		const timingToCreateDevServer = timings.start('create dev server');
		const server = createDevServer({filer});
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
