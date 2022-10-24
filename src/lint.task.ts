import {printSpawnResult, spawn} from '@feltcoop/felt/util/process.js';
import z from 'zod';

import {TaskError, type Task} from './task/task.js';
import {printCommandArgs, serializeArgs, toForwardedArgs, type ArgsSchema} from './utils/args.js';
import {SOURCE_DIRNAME} from './paths.js';
import {toVocabSchema} from './utils/schema.js';

// TODO BLOCK include the schema on the task
const Args = z.object({
	_: z.array(z.string(), {description: 'paths to serve'}).default([SOURCE_DIRNAME]),
});
type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'run eslint on the source files',
	args: toVocabSchema(Args, 'LintTaskArgs') as ArgsSchema,
	run: async ({fs, log, args}): Promise<void> => {
		if (!(await fs.exists('node_modules/.bin/eslint'))) {
			log.info('ESLint is not installed; skipping linting');
			return;
		}
		const {_} = args;
		const forwardedArgs = {_, 'max-warnings': 0, ...toForwardedArgs('eslint')};
		const serializedArgs = ['eslint', ...serializeArgs(forwardedArgs)];
		log.info(printCommandArgs(serializedArgs));
		const eslintResult = await spawn('npx', serializedArgs);
		if (!eslintResult.ok) {
			throw new TaskError(`ESLint found some problems. ${printSpawnResult(eslintResult)}`);
		}
	},
};
