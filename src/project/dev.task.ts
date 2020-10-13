import {Task} from '../task/task.js';
import {Filer} from '../build/Filer.js';
import {printTiming} from '../utils/print.js';
import {Timings} from '../utils/time.js';
import {createDefaultCompiler} from '../compile/defaultCompiler.js';
import {paths} from '../paths.js';
import {loadBuildConfigs} from '../build/buildConfig.js';
import {createDevServer} from '../devServer/devServer.js';
import {loadTsconfig, toEcmaScriptTarget} from '../compile/tsHelpers.js';

export const task: Task = {
	description: 'build typescript in watch mode for development',
	run: async ({log}) => {
		const timings = new Timings();

		const timingToLoadConfig = timings.start('load build configs');
		const buildConfigs = await loadBuildConfigs();
		timingToLoadConfig();

		const timingToLoadTsconfig = timings.start('load tsconfig');
		const tsconfig = loadTsconfig(log);
		const target = toEcmaScriptTarget(tsconfig.compilerOptions?.target);
		const sourceMap = tsconfig.compilerOptions?.sourceMap ?? true;
		timingToLoadTsconfig();

		const timingToCreateFiler = timings.start('create filer');
		const filer = new Filer({
			compiler: createDefaultCompiler(),
			compiledDirs: [paths.source],
			buildConfigs,
			sourceMap,
			target,
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
