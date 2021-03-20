import {Task} from './task/task.js';
import {printTiming} from './utils/print.js';
import {Timings} from './utils/time.js';
import {spawnProcess} from './utils/process.js';
import {toBuildOutPath, toRootPath} from './paths.js';
import {DEFAULT_BUILD_CONFIG_NAME} from './config/defaultBuildConfig.js';

// Runs the project's tests: `gro test [...args]`
// Args are passed through directly to `uvu`'s CLI:
// https://github.com/lukeed/uvu/blob/master/docs/cli.md

export const task: Task = {
	description: 'run tests',
	run: async ({log}): Promise<void> => {
		const timings = new Timings();

		const dev = process.env.NODE_ENV !== 'production';
		const dir = toRootPath(toBuildOutPath(dev, DEFAULT_BUILD_CONFIG_NAME));

		// TODO return value?
		const timeToRunUvu = timings.start('run test with uvu');
		await spawnProcess('npx', ['uvu', dir, '.+\\.test\\.js$', ...process.argv.slice(3)]);
		timeToRunUvu();

		for (const [key, timing] of timings.getAll()) {
			log.trace(printTiming(key, timing));
		}
	},
};
