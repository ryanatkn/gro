import {Task} from '../task/task.js';
import {FileCache} from '../fs/FileCache.js';
import {printTiming} from '../utils/print.js';
import {Timings} from '../utils/time.js';
import {createCompiler} from '../compile/compiler.js';

export const task: Task = {
	description: 'build typescript in watch mode for development',
	run: async ({log}) => {
		// TODO how to do this?
		const dev = process.env.NODE_ENV === 'development';

		const timings = new Timings();
		const fileCache = new FileCache({compiler: createCompiler({dev, log})});

		const timingToInitFileCache = timings.start('init file cache');
		await fileCache.init();
		timingToInitFileCache();

		for (const [key, timing] of timings.getAll()) {
			log.trace(printTiming(key, timing));
		}
	},
};
