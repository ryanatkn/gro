import {printTimings} from '@feltjs/util/print.js';
import {Timings} from '@feltjs/util/timings.js';
import {yellow} from 'kleur/colors';
import {z} from 'zod';
import {run} from 'uvu/run';
import {parse} from 'uvu/parse';

import type {Task} from './task/task.js';
import {paths} from './path/paths.js';
import {findCli} from './util/cli.js';

export const Args = z
	.object({
		_: z
			.array(z.string(), {description: 'file patterns to test'})
			.default([`\\.test\\.ts`]), // TODO maybe use uvu's default instead of being restrictive?
		bail: z
			.boolean({description: 'the bail option to uvu run, exit immediately on failure'})
			.default(false),
			cwd: z
			.string({description: 'the cwd option to uvu parse'}).optional(),
			// TOOD BLOCK support `gro test --help` with unions
		ignore: z
		.union([z.string(),z.array(z.string())], {description: 'the ignore option to uvu parse'}).optional()
	})
	.strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'run tests',
	Args,
	run: async ({fs, log, args}): Promise<void> => {
		const {_: patterns, bail, cwd, ignore} = args;
		console.log(`ignore`, ignore);

		if (!(await findCli(fs, 'uvu'))) {
			log.warn(yellow('uvu is not installed, skipping tests'));
			return;
		}

		const timings = new Timings();
		const timeToRunUvu = timings.start('run tests with uvu');

		// uvu doesn't work with esm loaders and TypeScript files,
		// so we use its `parse` and `run` APIs directly instead of its CLI
		const parsed = await parse(paths.source, patterns[0], {cwd,ignore})
		await run(parsed.suites, {bail});

		timeToRunUvu();

		printTimings(timings, log);

		// TODO BLOCK how to detect?
		// if (!testRunResult?.ok) {
		// 	throw new TaskError('Tests failed.');
		// }
	},
};
