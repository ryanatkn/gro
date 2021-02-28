import {Task} from './task/task.js';
import {Filer} from './build/Filer.js';
import {createDevServer} from './server/server.js';
import {createDefaultBuilder} from './build/defaultBuilder.js';
import {paths, toBuildOutPath} from './paths.js';
import {loadGroConfig} from './config/config.js';
import {configureLogLevel} from './utils/log.js';

export const task: Task = {
	description: 'start development server',
	run: async (): Promise<void> => {
		const config = await loadGroConfig();
		configureLogLevel(config.logLevel);
		// TODO should this be `findServedBuildConfig`? or should this be a property on the config itself?
		// maybe that gets added by a normalization step?
		const buildConfigToServe = config.primaryBrowserBuildConfig ?? config.primaryNodeBuildConfig;
		const buildOutDirToServe = toBuildOutPath(true, buildConfigToServe.name, '');

		const filer = new Filer({
			builder: await createDefaultBuilder(),
			sourceDirs: [paths.source],
			servedDirs: [buildOutDirToServe],
			buildConfigs: config.builds,
			target: config.target,
			sourceMap: config.sourceMap,
		});

		const server = createDevServer({filer});

		await Promise.all([filer.init(), server.start()]);
	},
};
