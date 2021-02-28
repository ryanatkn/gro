import {Task} from '../task/task.js';
import {Filer} from '../build/Filer.js';
import {printTiming} from '../utils/print.js';
import {Timings} from '../utils/time.js';
import {createDefaultBuilder} from '../build/defaultBuilder.js';
import {paths, toBuildOutPath} from '../paths.js';
import {createDevServer} from '../server/server.js';
import {loadGroConfig} from '../config/config.js';
import {configureLogLevel} from '../utils/log.js';

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
			servedDirs: [toBuildOutPath(true, 'browser', 'client'), toBuildOutPath(true, 'browser', '')],
			buildConfigs: config.builds,
			target: config.target,
			sourceMap: config.sourceMap,
		});
		timingToCreateFiler();

		const timingToInitFiler = timings.start('init filer');
		await filer.init();
		timingToInitFiler();

		const timingToStartDevServer = timings.start('start dev server');
		const server = createDevServer({filer});
		await server.start();
		timingToStartDevServer();

		for (const [key, timing] of timings.getAll()) {
			log.trace(printTiming(key, timing));
		}
	},
};
