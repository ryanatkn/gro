import {print_spawn_result} from '@ryanatkn/belt/process.js';
import {z} from 'zod';

import {Task_Error, type Task} from './task.js';
import {serialize_args, to_forwarded_args} from './args.js';
import {find_cli, spawn_cli} from './cli.js';

const ESLINT_CLI = 'eslint';

export const Args = z
	.interface({
		_: z.array(z.string(), {description: 'paths to serve'}).default([]),
		eslint_cli: z.string({description: 'the ESLint CLI to use'}).default(ESLINT_CLI),
	})
	.strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'run eslint',
	Args,
	run: async ({log, args}): Promise<void> => {
		const {_, eslint_cli} = args;

		const found_eslint_cli = find_cli(eslint_cli);
		if (!found_eslint_cli) {
			// TODO maybe make this an option?
			log.info('ESLint is not installed; skipping linting');
			return;
		}

		const forwarded_args = {_, 'max-warnings': 0, ...to_forwarded_args(eslint_cli)};
		const serialized_args = serialize_args(forwarded_args);
		const eslintResult = await spawn_cli(found_eslint_cli, serialized_args, log);
		if (!eslintResult?.ok) {
			throw new Task_Error(`ESLint found some problems. ${print_spawn_result(eslintResult!)}`);
		}
	},
};
