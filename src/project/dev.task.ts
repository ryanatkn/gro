import {Task} from '../task/task.js';
import {Filer} from '../fs/Filer.js';
import {printTiming} from '../utils/print.js';
import {Timings} from '../utils/time.js';
import {createDefaultCompiler} from '../compile/defaultCompiler.js';
import {paths} from '../paths.js';
import {loadBuildConfigs} from './buildConfig.js';

export const task: Task = {
	description: 'build typescript in watch mode for development',
	run: async ({log}) => {
		const timings = new Timings();
		const filer = new Filer({
			compiler: createDefaultCompiler(),
			compiledDirs: [{sourceDir: paths.source, outDir: paths.build}],
			buildConfigs: await loadBuildConfigs(),
		});

		const timingToInitFiler = timings.start('init filer');
		await filer.init();
		timingToInitFiler();

		for (const [key, timing] of timings.getAll()) {
			log.trace(printTiming(key, timing));
		}
	},
};
