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
		const forwardedArgs = {_, 'max-warnings': 0, ...toForwardedArgs('eslint')};
		const serializedArgs = ['eslint', ...serializeArgs(forwardedArgs)];
		log.info(magenta('running command:'), serializedArgs.join(' '));
		const eslintResult = await spawn('npx', serializedArgs);
		if (!eslintResult.ok) {
			throw new TaskError(`ESLint found some problems. ${printSpawnResult(eslintResult)}`);
		}
	},
};
