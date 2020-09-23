import {Task} from '../task/task.js';
import {CachingCompiler} from '../compile/CachingCompiler.js';
import {printTiming} from '../utils/print.js';
import {Timings} from '../utils/time.js';
import {createCompileFile} from '../compile/compileFile.js';

export const task: Task = {
	description: 'build typescript in watch mode for development',
	run: async ({log}) => {
		const timings = new Timings();

		const compiler = new CachingCompiler({compileFile: createCompileFile(log)});

		const timingToInitCachingCompiler = timings.start('init caching compiler');
		await compiler.init();
		timingToInitCachingCompiler();

		for (const [key, timing] of timings.getAll()) {
			log.trace(printTiming(key, timing));
		}
	},
};
