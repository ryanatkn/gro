import {printTimings} from '@feltjs/util/print.js';
import {Timings} from '@feltjs/util/timings.js';
import {yellow} from 'kleur/colors';
import {z} from 'zod';
import glob from 'tiny-glob';
import {run} from 'uvu/run';

import type {Task} from './task/task.js';
import {SOURCE_DIR, source_id_to_base_path} from './path/paths.js';
import {findCli} from './util/cli.js';

export const Args = z
	.object({
		_: z
			.array(z.string(), {description: 'file patterns to test'})
			.default([`${SOURCE_DIR}**/*.test.ts`]),
		bail: z
			.boolean({description: 'the uvu bail option, exit immediately on failure'})
			.default(false),
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
		// so this unfortunately duplicates some of its internals.

		const suites = await collect(patterns);
		await run(suites, {bail});

		timeToRunUvu();

		printTimings(timings, log);

		// TODO BLOCK how to detect?
		// if (!testRunResult?.ok) {
		// 	throw new TaskError('Tests failed.');
		// }
	},
};

interface UvuSuite {
	name: string;
	file: string; // absolute path
}

const collect = async (patterns: string[]): Promise<UvuSuite[]> => {
	const suites: UvuSuite[] = [];

	for (const pattern of patterns) {
		const files = await glob(pattern, {filesOnly: true, absolute: true}); // eslint-disable-line no-await-in-loop
		for (const file of files) {
			suites.push({name: source_id_to_base_path(file), file});
		}
	}

	return suites;
};
