import {printSpawnResult, spawn} from '@feltcoop/felt/util/process.js';

import {TaskError, type Task} from './task/task.js';
import {SOURCE_DIRNAME} from './paths.js';

export const task: Task = {
	summary: 'run eslint on the source files',
	run: async ({fs, log}): Promise<void> => {
		if (await fs.exists('node_modules/.bin/eslint')) {
			const eslintResult = await spawn('npx', ['eslint', SOURCE_DIRNAME]);
			if (!eslintResult.ok) {
				throw new TaskError(`ESLint found some problems. ${printSpawnResult(eslintResult)}`);
			}
		} else {
			log.info('ESLint is not installed; skipping linting');
		}
	},
};
