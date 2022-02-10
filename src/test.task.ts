import {printTimings} from '@feltcoop/felt/util/print.js';
import {Timings} from '@feltcoop/felt/util/timings.js';
import {spawn} from '@feltcoop/felt/util/process.js';
import {yellow} from 'kleur/colors';

import {TaskError, type Task} from './task/task.js';
import {toBuildOutPath, toRootPath} from './paths.js';
import {SYSTEM_BUILD_NAME} from './build/buildConfigDefaults.js';
import {loadConfig} from './config/config.js';
import {buildSource} from './build/buildSource.js';
import {type TestTaskArgs} from './testTask.js';
import {TestTaskArgsSchema} from './testTask.schema.js';

// Runs the project's tests: `gro test [...args]`
// Args are passed through directly to `uvu`'s CLI:
// https://github.com/lukeed/uvu/blob/master/docs/cli.md

const DEFAULT_TEST_FILE_PATTERNS = ['.+\\.test\\.js$'];

export const task: Task<TestTaskArgs> = {
	summary: 'run tests',
	args: TestTaskArgsSchema,
	run: async ({fs, dev, log, args}): Promise<void> => {
		const patternCount = args._.length;
		const testFilePatterns = patternCount ? args._ : DEFAULT_TEST_FILE_PATTERNS;

		const timings = new Timings();

		const timingToLoadConfig = timings.start('load config');
		const config = await loadConfig(fs, dev);
		timingToLoadConfig();

		// TODO cleaner way to detect & rebuild?
		const timingToPrebuild = timings.start('prebuild');
		await buildSource(fs, config, dev, log);
		timingToPrebuild();

		// Projects may not define any artifacts for the Node build,
		// and we don't force anything out in that case,
		// so just exit early if that happens.
		const testsBuildDir = toBuildOutPath(dev, SYSTEM_BUILD_NAME);
		if (!(await fs.exists(testsBuildDir))) {
			log.info(yellow('no tests found'));
			return;
		}

		const timeToRunUvu = timings.start('run test with uvu');
		const testRunResult = await spawn('npx', [
			'uvu',
			toRootPath(testsBuildDir),
			...testFilePatterns,
			...process.argv.slice(3 + patternCount),
			'-i',
			'.map$', // ignore sourcemap files so patterns don't need `.js$`
		]);
		timeToRunUvu();

		printTimings(timings, log);

		if (!testRunResult.ok) {
			throw new TaskError('Tests failed.');
		}
	},
};
