import {Task} from '../task/task.js';
import {Filer} from '../build/Filer.js';
import {printTiming} from '../utils/print.js';
import {Timings} from '../utils/time.js';
import {createDefaultBuilder} from '../build/defaultBuilder.js';
import {paths} from '../paths.js';
import {createDevServer} from '../devServer/devServer.js';
import {loadTsconfig, toEcmaScriptTarget} from '../build/tsBuildHelpers.js';
import {loadGroConfig} from '../config/config.js';

export const task: Task = {
	description: 'build typescript in watch mode for development',
	run: async ({log}) => {
		const timings = new Timings();

		const timingToLoadConfig = timings.start('load config');
		const config = await loadGroConfig();
		timingToLoadConfig();

		// TODO probably replace these with the Gro config values
		// see the `src/dev.task.ts` for the same thing
		const timingToLoadTsconfig = timings.start('load tsconfig');
		const tsconfig = loadTsconfig(log);
		const target = toEcmaScriptTarget(tsconfig.compilerOptions?.target);
		const sourceMap = tsconfig.compilerOptions?.sourceMap ?? true;
		timingToLoadTsconfig();

		const timingToCreateFiler = timings.start('create filer');
		const filer = new Filer({
			compiler: createDefaultBuilder(),
			compiledDirs: [paths.source],
			buildConfigs: config.builds,
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
