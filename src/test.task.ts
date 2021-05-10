import type {Task} from './task/task.js';
import {TaskError} from './task/task.js';
import {printTimings} from './utils/print.js';
import {Timings} from './utils/time.js';
import {spawnProcess} from './utils/process.js';
import {toBuildOutPath, toRootPath} from './paths.js';
import {PRIMARY_NODE_BUILD_NAME} from './config/defaultBuildConfig.js';
import {loadGroConfig} from './config/config.js';
import {buildSourceDirectory} from './build/buildSourceDirectory.js';

// Runs the project's tests: `gro test [...args]`
// Args are passed through directly to `uvu`'s CLI:
// https://github.com/lukeed/uvu/blob/master/docs/cli.md

const DEFAULT_TEST_FILE_PATTERNS = ['.+\\.test\\.js$'];

export const task: Task = {
	description: 'run tests',
	run: async ({fs, dev, log, args}): Promise<void> => {
		const timings = new Timings();

		const testsBuildDir = toBuildOutPath(dev, PRIMARY_NODE_BUILD_NAME);

		// TODO cleaner way to detect & rebuild?
		if (!(await fs.exists(testsBuildDir))) {
			const timingToLoadConfig = timings.start('load config');
			const config = await loadGroConfig(fs, dev);
			timingToLoadConfig();

			const timingToPrebuild = timings.start('prebuild');
			await buildSourceDirectory(fs, config, dev, log);
			timingToPrebuild();

			// Projects may not define any artifacts for the Node build,
			// and we don't force anything out in that case,
			// so just exit early if that happens.
			if (!(await fs.exists(testsBuildDir))) {
				log.info('no tests found');
				return;
			}
		}

		const timeToRunUvu = timings.start('run test with uvu');
		const testRunResult = await spawnProcess('npx', [
			'uvu',
			toRootPath(testsBuildDir),
			...(args._.length ? args._ : DEFAULT_TEST_FILE_PATTERNS),
			...process.argv.slice(3),
		]);
		timeToRunUvu();

		printTimings(timings, log);

		if (!testRunResult.ok) {
			throw new TaskError('Tests failed.');
		}
	},
};
