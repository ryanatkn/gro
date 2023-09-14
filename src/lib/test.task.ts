import {yellow} from 'kleur/colors';
import {z} from 'zod';
import {run} from 'uvu/run';
import {parse} from 'uvu/parse';

import {TaskError, type Task} from './task/task.js';
import {paths} from './util/paths.js';
import {find_cli} from './util/cli.js';

export const Args = z
	.object({
		_: z.array(z.string(), {description: 'file patterns to test'}).default([`\\.test\\.ts$`]), // TODO maybe use uvu's default instead of being restrictive?
		bail: z
			.boolean({description: 'the bail option to uvu run, exit immediately on failure'})
			.default(false),
		cwd: z.string({description: 'the cwd option to uvu parse'}).optional(),
		ignore: z
			.union([z.string(), z.array(z.string())], {description: 'the ignore option to uvu parse'})
			.optional(),
	})
	.strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'run tests',
	Args,
	run: async ({args, log}): Promise<void> => {
		const {_: patterns, bail, cwd, ignore} = args;

		if (!(await find_cli('uvu'))) {
			log.warn(yellow('uvu is not installed, skipping tests'));
			return;
		}

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
			throw new TaskError('Tests failed.');
		}
	},
};
