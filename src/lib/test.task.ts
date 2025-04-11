import {styleText as st} from 'node:util';
import {z} from 'zod';

import {Task_Error, type Task} from './task.js';
import {paths} from './paths.js';
import {find_cli} from './cli.js';

export const Args = z.strictInterface({
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
	run: async ({args, log}): Promise<void> => {
		const {_: patterns, bail, cwd, ignore} = args;

		if (!find_cli('uvu')) {
			log.warn(st('yellow', 'uvu is not installed, skipping tests'));
			return;
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
			throw new Task_Error('Tests failed.');
		}
	},
};
