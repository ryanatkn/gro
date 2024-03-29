import {print_spawn_result} from '@ryanatkn/belt/process.js';
import {z} from 'zod';

import {Task_Error, type Task} from './task.js';
import {print_command_args, serialize_args, to_forwarded_args} from './args.js';
import {SOURCE_DIRNAME} from './paths.js';
import {find_cli, spawn_cli} from './cli.js';

export const Args = z
	.object({
		_: z.array(z.string(), {description: 'paths to serve'}).default([SOURCE_DIRNAME]),
	})
	.strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'run eslint',
	Args,
	run: async ({log, args}): Promise<void> => {
		if (!(await find_cli('eslint'))) {
			log.info('ESLint is not installed; skipping linting');
			return;
		}
		const {_} = args;
		const forwarded_args = {_, 'max-warnings': 0, ...to_forwarded_args('eslint')};
		const serialized_args = serialize_args(forwarded_args);
		log.info(print_command_args(['eslint'].concat(serialized_args)));
		const eslintResult = await spawn_cli('eslint', serialized_args);
		if (!eslintResult?.ok) {
			throw new Task_Error(`ESLint found some problems. ${print_spawn_result(eslintResult!)}`);
		}
	},
};
