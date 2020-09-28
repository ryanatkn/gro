import {Task} from '../task/task.js';
import {Filer} from '../fs/Filer.js';
import {printTiming} from '../utils/print.js';
import {Timings} from '../utils/time.js';
import {createDefaultCompiler} from '../compile/defaultCompiler.js';

export const task: Task = {
	description: 'build typescript in watch mode for development',
	run: async ({log}) => {
		const timings = new Timings();
		const filer = new Filer({compiler: createDefaultCompiler()});

		const timingToInitFiler = timings.start('init filer');
		await filer.init();
		timingToInitFiler();

		for (const [key, timing] of timings.getAll()) {
			log.trace(printTiming(key, timing));
		}
	},
};
