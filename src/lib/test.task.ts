import {printTimings} from '@feltjs/util/print.js';
import {Timings} from '@feltjs/util/timings.js';
import {yellow} from 'kleur/colors';
import {z} from 'zod';
import glob from 'tiny-glob';
import {run} from 'uvu/run';
import {parse} from 'uvu/parse';

import type {Task} from './task/task.js';
import {paths, source_id_to_base_path} from './path/paths.js';
import {findCli} from './util/cli.js';

export const Args = z
	.object({
		_: z
			.array(z.string(), {description: 'file patterns to test'})
			.default([`\\.test\\.ts`]), // TODO maybe use uvu's default instead of being restrictive?
		bail: z
			.boolean({description: 'the uvu bail option, exit immediately on failure'})
			.default(false),
			// TODO BLOCK support ignore
	})
	.strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'run tests',
	Args,
	run: async ({fs, log, args}): Promise<void> => {
		const {_: patterns, bail} = args;

		if (!(await findCli(fs, 'uvu'))) {
			log.warn(yellow('uvu is not installed, skipping tests'));
			return;
		}

		const timings = new Timings();
		const timeToRunUvu = timings.start('run tests with uvu');

		// uvu doesn't work with esm loaders and TypeScript files,
		// so we use its `parse` and `run` APIs directly instead of its CLI
		const parsed = await parse(paths.source, patterns[0])
		await run(parsed.suites, {bail});

		timeToRunUvu();

		printTimings(timings, log);

		// TODO BLOCK how to detect?
		// if (!testRunResult?.ok) {
		// 	throw new TaskError('Tests failed.');
		// }
	},
};
