import {printSpawnResult} from '@feltjs/util/process.js';
import {z} from 'zod';

import {TaskError, type Task} from './task/task.js';
import {printCommandArgs, serializeArgs, toForwardedArgs} from './task/args.js';
import {SOURCE_DIRNAME} from './path/paths.js';
import {findCli, spawnCli} from './util/cli.js';

const Args = z
	.object({
		_: z.array(z.string(), {description: 'paths to serve'}).default([SOURCE_DIRNAME]),
	})
	.strict();
type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'run eslint on the source files',
	Args,
	run: async ({fs, log, args}): Promise<void> => {
		if (!(await findCli(fs, 'eslint'))) {
			log.info('ESLint is not installed; skipping linting');
			return;
		}
		const {_} = args;
		const forwardedArgs = {_, 'max-warnings': 0, ...toForwardedArgs('eslint')};
		const serializedArgs = serializeArgs(forwardedArgs);
		log.info(printCommandArgs(['eslint'].concat(serializedArgs)));
		const eslintResult = await spawnCli(fs, 'eslint', serializedArgs);
		if (!eslintResult?.ok) {
			throw new TaskError(`ESLint found some problems. ${printSpawnResult(eslintResult!)}`);
		}
	},
};
