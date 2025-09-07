import {z} from 'zod';
import {spawn_cli} from '@ryanatkn/gro/cli.js';

import {Task_Error, type Task} from './task.ts';
import {find_cli} from './cli.ts';
import {has_dep} from './package_json.ts';
import {serialize_args, to_forwarded_args} from './args.ts';
import {VITEST_CLI} from './constants.ts';
import {paths} from './paths.ts';

export const Args = z.strictObject({
	_: z.array(z.string()).meta({description: 'file patterns to filter tests'}).default(['.test.']),
	dir: z.string().meta({description: 'working directory for tests'}).default(paths.source),
	fail_without_tests: z
		.boolean()
		.meta({description: 'opt out of `passWithNoTests`'})
		.default(false),
	t: z
		.string()
		.meta({description: 'search pattern for test names, same as vitest -t and --testNamePattern'})
		.optional(),
});
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'run tests with vitest',
	Args,
	run: async ({args}): Promise<void> => {
		const {_: patterns, dir, fail_without_tests, t} = args;

		if (!has_dep(VITEST_CLI)) {
			throw new Task_Error('no test runner found, install vitest');
		}

		if (!find_cli(VITEST_CLI)) {
			throw new Task_Error('vitest is a dependency but not installed; run `npm i`?');
		}

		const vitest_args = ['run', ...patterns];
		if (dir) {
			vitest_args.push('--dir', dir);
		}
		if (!fail_without_tests) {
			vitest_args.push('--passWithNoTests');
		}
		if (t) {
			vitest_args.push('-t', t);
		}
		vitest_args.push(...serialize_args(to_forwarded_args(VITEST_CLI)));

		const spawned = await spawn_cli(VITEST_CLI, vitest_args);
		if (!spawned?.ok) {
			throw new Task_Error(`vitest failed with exit code ${spawned?.code}`);
		}
	},
};
