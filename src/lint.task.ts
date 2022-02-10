import {printSpawnResult, spawn} from '@feltcoop/felt/util/process.js';

import {serializeArgs, TaskError, type Task} from './task/task.js';
import {type LintTaskArgs} from './lintTask';
import {LintTaskArgsSchema} from './lintTask.schema.js';

export const task: Task<LintTaskArgs> = {
	summary: 'run eslint on the source files',
	args: LintTaskArgsSchema,
	run: async ({fs, log, args}): Promise<void> => {
		if (!(await fs.exists('node_modules/.bin/eslint'))) {
			log.info('ESLint is not installed; skipping linting');
			return;
		}
		const eslintResult = await spawn('npx', [
			'eslint',
			// TODO forwarding all args like this won't work,
			// the `--` or `__` pattern needs to be used
			// or both? because then invokers can choose to pass args forward
			...serializeArgs({'max-warnings': 0, ...args}),
		]);
		if (!eslintResult.ok) {
			throw new TaskError(`ESLint found some problems. ${printSpawnResult(eslintResult)}`);
		}
	},
};
