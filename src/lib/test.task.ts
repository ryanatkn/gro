import {printTimings} from '@feltjs/util/print.js';
import {Timings} from '@feltjs/util/timings.js';
import {yellow} from 'kleur/colors';
import {z} from 'zod';

import {TaskError, type Task} from './task/task.js';
import {SOURCE_DIR, is_this_project_gro} from './path/paths.js';
import {addArg, printCommandArgs, serializeArgs, toForwardedArgs} from './task/args.js';
import {findCli, spawnCli} from './util/cli.js';

// Runs the project's tests: `gro test [...patterns] [-- uvu [...args]]`.
// Args following any `-- uvu` are passed through to `uvu`'s CLI:
// https://github.com/lukeed/uvu/blob/master/docs/cli.md
// If the `uvu` segment's args contain any rest arg patterns,
// the base patterns are ignored.

export const Args = z
	.object({
		_: z.array(z.string(), {description: 'file patterns to test'}).default(['.+\\.test\\.js$']),
	})
	.strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'run tests',
	Args,
	run: async ({fs, log, args}): Promise<void> => {
		const {_: testFilePatterns} = args;

		if (!(await findCli(fs, 'uvu'))) {
			log.warn(yellow('uvu is not installed, skipping tests'));
			return;
		}

		const timings = new Timings();

		const timeToRunUvu = timings.start('run tests with uvu');
		const forwardedArgs = toForwardedArgs('uvu');
		if (!forwardedArgs._) {
			const loader_path = is_this_project_gro ? './dist/loader.js' : '@feltjs/gro/loader.js';
			// TODO BLOCK `SOURCE_DIR` used to be `toRootPath(testsBuildDir)`, may be wrong
			forwardedArgs._ = ['--loader', loader_path, SOURCE_DIR, ...testFilePatterns];
		}
		// ignore sourcemap files so patterns don't need `.js$`
		addArg(forwardedArgs, '.map$', 'i', 'ignore');
		const serializedArgs = serializeArgs(forwardedArgs);
		log.info(printCommandArgs(['uvu'].concat(serializedArgs)));
		const testRunResult = await spawnCli(fs, 'uvu', serializedArgs);
		timeToRunUvu();

		printTimings(timings, log);

		if (!testRunResult?.ok) {
			throw new TaskError('Tests failed.');
		}
	},
};
