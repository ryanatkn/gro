import {printTimings} from '@feltcoop/felt/util/print.js';
import {Timings} from '@feltcoop/felt/util/timings.js';
import {spawn} from '@feltcoop/felt/util/process.js';
import {yellow} from 'kleur/colors';
import {z} from 'zod';

import {TaskError, type Task} from './task/task.js';
import {toBuildOutPath, toRootPath} from './paths.js';
import {SYSTEM_BUILD_NAME} from './build/buildConfigDefaults.js';
import {addArg, printCommandArgs, serializeArgs, toForwardedArgs} from './utils/args.js';

// Runs the project's tests: `gro test [...patterns] [-- uvu [...args]]`.
// Args following any `-- uvu` are passed through to `uvu`'s CLI:
// https://github.com/lukeed/uvu/blob/master/docs/cli.md
// If the `uvu` segment's args contain any rest arg patterns,
// the base patterns are ignored.

const Args = z
	.object({
		_: z.array(z.string(), {description: 'file patterns to test'}).default(['.+\\.test\\.js$']),
	})
	.strict();
type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'run tests',
	Args,
	run: async ({fs, dev, log, args}): Promise<void> => {
		const {_: testFilePatterns} = args;

		if (!(await fs.exists('node_modules/.bin/uvu'))) {
			log.warn(yellow('uvu is not installed, skipping tests'));
			return;
		}

		const timings = new Timings();

		// Projects may not define any artifacts for the Node build,
		// and we don't force anything out in that case,
		// so just exit early if that happens.
		const testsBuildDir = toBuildOutPath(dev, SYSTEM_BUILD_NAME);
		if (!(await fs.exists(testsBuildDir))) {
			log.info(yellow('no tests found'));
			return;
		}

		const timeToRunUvu = timings.start('run tests with uvu');
		const forwardedArgs = toForwardedArgs('uvu');
		if (!forwardedArgs._) {
			forwardedArgs._ = [toRootPath(testsBuildDir), ...testFilePatterns];
		}
		// ignore sourcemap files so patterns don't need `.js$`
		addArg(forwardedArgs, '.map$', 'i', 'ignore');
		const serializedArgs = ['uvu', ...serializeArgs(forwardedArgs)];
		log.info(printCommandArgs(serializedArgs));
		const testRunResult = await spawn('npx', serializedArgs);
		timeToRunUvu();

		printTimings(timings, log);

		if (!testRunResult.ok) {
			throw new TaskError('Tests failed.');
		}
	},
};
