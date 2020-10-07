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
			compiledDirs: [paths.source, paths.externals],
			servedDirs: [
				// TODO does this API make sense? seems weird
				`${buildOutDir}/frontend`,
				{dir: paths.externals, servedAt: paths.build},
			],
			// dirs: [
			// 	{dir: paths.source, compiled: true},
			// 	{dir: `${buildOutDir}/frontend`, served: true},
			// 	{dir: paths.externals, compiled: true, served: true, servedAt: paths.build},
			// ],
			buildConfigs,
		});
		timingToCreateFiler();

		const timingToInitFiler = timings.start('init filer');
		await filer.init();
		timingToInitFiler();

		// TODO this could be done in parallel with initializing the filer,
		// but we may want to see its timings instead
		const timingToStartDevServer = timings.start('start dev server');
		const devServer = createDevServer({filer});
		await devServer.start();
		timingToStartDevServer();

		for (const [key, timing] of timings.getAll()) {
			log.trace(printTiming(key, timing));
		}
	},
};
