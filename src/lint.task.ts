import {printSpawnResult, spawn} from '@feltcoop/felt/util/process.js';
import {magenta} from 'kleur/colors';

import {TaskError, type Task} from './task/task.js';
import {serializeArgs, toForwardedArgs} from './utils/args.js';
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
		const {_} = args;
		const forwardedEslintArgs = toForwardedArgs('eslint');
		const eslintArgs = {_, 'max-warnings': 0, ...forwardedEslintArgs};
		const serializedEslintArgs = ['eslint', ...serializeArgs(eslintArgs)];
		log.info(magenta('running command:'), serializedEslintArgs.join(' '));
		const eslintResult = await spawn('npx', serializedEslintArgs);
		if (!eslintResult.ok) {
			throw new TaskError(`ESLint found some problems. ${printSpawnResult(eslintResult)}`);
		}
	},
};
