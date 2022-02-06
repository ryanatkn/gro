import {printSpawnResult, spawn} from '@feltcoop/felt/util/process.js';

import {serializeArgs, TaskError, type Task} from './task/task.js';
import {SOURCE_DIRNAME} from './paths.js';

// TODO how to pass through args from `gro check`?

export const task: Task = {
	summary: 'run eslint on the source files',
	run: async ({fs, log, args}): Promise<void> => {
		if (!(await fs.exists('node_modules/.bin/eslint'))) {
			log.info('ESLint is not installed; skipping linting');
			return;
		}
		const eslintArgs = args._.length ? args : {...args, _: [SOURCE_DIRNAME]};
		const eslintResult = await spawn('npx', ['eslint', ...serializeArgs(eslintArgs)]);
		if (!eslintResult.ok) {
			throw new TaskError(`ESLint found some problems. ${printSpawnResult(eslintResult)}`);
		}
	},
};
