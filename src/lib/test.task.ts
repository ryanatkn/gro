import {z} from 'zod';
import {spawn_cli} from '@ryanatkn/gro/cli.js';

import {Task_Error, type Task} from './task.ts';
import {paths} from './paths.ts';
import {find_cli} from './cli.ts';
import {has_dep} from './package_json.ts';

export const Args = z.strictObject({
	_: z.array(z.string()).meta({description: 'file patterns to test'}).default([`\\.test\\.ts$`]), // TODO maybe use uvu's default instead of being restrictive?
	bail: z
		.boolean()
		.meta({description: 'the bail option to uvu run, exit immediately on failure'})
		.default(false),
	cwd: z.string().meta({description: 'the cwd option to uvu parse'}).optional(),
	ignore: z
		.union([z.string(), z.array(z.string())])
		.meta({description: 'the ignore option to uvu parse'})
		.optional(),
});
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'run tests with uvu',
	Args,
	run: async ({args}): Promise<void> => {
		const {_: patterns, bail, cwd, ignore} = args;

		if (has_dep('vitest')) {
			if (!find_cli('vitest')) {
				throw new Task_Error('vitest is a dependency but not installed; run `npm i`?');
			}
			const spawned = await spawn_cli('vitest', ['run', ...patterns, '--dir', 'src']); // TODO proper forwarding
			if (!spawned?.ok) {
				throw new Task_Error(`vitest failed with exit code ${spawned?.code}`);
			}
		} else if (has_dep('uvu')) {
			if (!find_cli('uvu')) {
				throw new Task_Error('uvu is a dependency but not installed; run `npm i`?');
			}

			const [{run}, {parse}] = await Promise.all([import('uvu/run'), import('uvu/parse')]);

			// uvu doesn't work with esm loaders and TypeScript files,
			// so we use its `parse` and `run` APIs directly instead of its CLI.
			// To avoid surprises, we allow any number of patterns in the rest args,
			// so we call `parse` multiple times because it supports only one.
			const suites = [];
			for (const pattern of patterns) {
				const parsed = await parse(paths.source, pattern, {cwd, ignore}); // eslint-disable-line no-await-in-loop
				suites.push(...parsed.suites);
			}
			await run(suites, {bail});
			if (process.exitCode) {
				throw new Task_Error(`uvu failed with exit code ${process.exitCode}`);
			}
		} else {
			throw new Task_Error('no test runner found, install vitest or uvu');
		}
	},
};
