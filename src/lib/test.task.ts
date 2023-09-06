import {printTimings} from '@feltjs/util/print.js';
import {Timings} from '@feltjs/util/timings.js';
import {yellow} from 'kleur/colors';
import {z} from 'zod';
import glob from 'tiny-glob';

import type {Task} from './task/task.js';
import {SOURCE_DIR} from './path/paths.js';
import {findCli} from './util/cli.js';

/* eslint-disable no-await-in-loop */

export const Args = z
	.object({
		_: z
			.array(z.string(), {description: 'file patterns to test'})
			.default([`${SOURCE_DIR}**/*.test.ts`]),
	})
	.strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'run tests',
	Args,
	run: async ({fs, log, args}): Promise<void> => {
		const {_: patterns} = args;

		if (!(await findCli(fs, 'uvu'))) {
			log.warn(yellow('uvu is not installed, skipping tests'));
			return;
		}

		const timings = new Timings();
		const timeToRunUvu = timings.start('run tests with uvu');

		// uvu doesn't work with esm loaders, so this unfortunately duplicates some of its runner logic.
		globalThis.UVU_DEFER = 1;
		for (const pattern of patterns) {
			const files = await glob(pattern, {filesOnly: true, absolute: true});
			for (const file of files) {
				await import(file);
			}
		}

		timeToRunUvu();

		printTimings(timings, log);

		// TODO BLOCK how to detect?
		// if (!testRunResult?.ok) {
		// 	throw new TaskError('Tests failed.');
		// }
	},
};
