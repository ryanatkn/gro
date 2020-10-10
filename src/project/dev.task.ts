import {Task} from '../task/task.js';
import {Filer} from '../build/Filer.js';
import {printTiming} from '../utils/print.js';
import {Timings} from '../utils/time.js';
import {createDefaultCompiler} from '../compile/defaultCompiler.js';
import {paths, toBuildOutDir} from '../paths.js';
import {loadBuildConfigs} from '../build/buildConfig.js';
import {createDevServer} from '../devServer/devServer.js';

export const task: Task = {
	description: 'build typescript in watch mode for development',
	run: async ({log}) => {
		const timings = new Timings();

		const timingToLoadConfig = timings.start('load build configs');
		const buildConfigs = await loadBuildConfigs();
		timingToLoadConfig();

		const timingToCreateFiler = timings.start('create filer');
		const buildOutDir = toBuildOutDir(
			true,
			buildConfigs.find((c) => c.platform === 'browser')!.name,
			'',
		);
		const filer = new Filer({
			compiler: createDefaultCompiler(),
			compiledDirs: [paths.source],
			servedDirs: [`${buildOutDir}/frontend`],
			buildConfigs,
		});
		timingToCreateFiler();

		const timingToInitFiler = timings.start('init filer');
		await filer.init();
		timingToInitFiler();

		const timingToStartDevServer = timings.start('start dev server');
		const devServer = createDevServer({filer});
		await devServer.start();
		timingToStartDevServer();

		for (const [key, timing] of timings.getAll()) {
			log.trace(printTiming(key, timing));
		}
	},
};
