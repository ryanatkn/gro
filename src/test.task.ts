import {Task} from './task/task.js';
import {printTiming} from './utils/print.js';
import {Timings} from './utils/time.js';
import {spawnProcess} from './utils/process.js';
import {toBuildOutPath, toRootPath} from './paths.js';
import {DEFAULT_BUILD_CONFIG_NAME} from './config/defaultBuildConfig.js';

// TODO now that this is wrapping `uvu`,
// we need to think about how to make this transparently
// expose its API instead of forcing a constrained wrapper on users.
// of course users can always override the task, so..

export const task: Task = {
	description: 'run tests',
	run: async ({log}): Promise<void> => {
		const timings = new Timings();

		const dev = process.env.NODE_ENV !== 'production';
		const dir = toRootPath(toBuildOutPath(dev, DEFAULT_BUILD_CONFIG_NAME));

		// TODO forward args (the raw value, before `mri` processes? do we have that available? maybe add `args._rawArgs`?)
		// TODO return value?
		const timeToRunUvu = timings.start('run test with uvu');
		await spawnProcess('npx', ['uvu', dir, '.+\\.test\\.js$']);
		timeToRunUvu();

		for (const [key, timing] of timings.getAll()) {
			log.trace(printTiming(key, timing));
		}
	},
};
