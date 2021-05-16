import type {EventEmitter} from 'events';

import {cyan, red} from '../utils/terminal.js';
import {printLogLabel, SystemLogger} from '../utils/log.js';
import type {TaskModuleMeta} from './taskModule.js';
import type {Args} from './task.js';
import {TaskError} from './task.js';
import type {invokeTask as InvokeTaskFunction} from './invokeTask.js';
import type {Filesystem} from '../fs/filesystem.js';

export type RunTaskResult =
	| {
			ok: true;
			output: unknown;
	  }
	| {
			ok: false;
			reason: string;
			error: Error;
	  };

export const runTask = async (
	fs: Filesystem,
	task: TaskModuleMeta,
	args: Args,
	events: EventEmitter,
	invokeTask: typeof InvokeTaskFunction,
	dev: boolean | undefined, // `undefined` on first task invocation, so it infers from the first task
): Promise<RunTaskResult> => {
	// TODO there's a contradiction here with how `dev` is handled,
	// and it's biting us with `gro check` in `gro publish`
	if (dev === undefined) {
		if (task.mod.task.dev !== undefined) {
			dev = task.mod.task.dev;
			process.env['NODE_ENV'] = dev ? 'development' : 'production';
		} else {
			dev = process.env.NODE_ENV !== 'production';
		}
	}
	let output: unknown;
	try {
		output = await task.mod.task.run({
			fs,
			dev,
			args,
			events,
			log: new SystemLogger(printLogLabel(task.name)),
			invokeTask: (
				invokedTaskName,
				invokedArgs = args,
				invokedEvents = events,
				invokedDev = dev,
				invokedFs = fs,
			) => invokeTask(invokedFs, invokedTaskName, invokedArgs, invokedEvents, invokedDev),
		});
	} catch (err) {
		return {
			ok: false,
			reason: red(
				err instanceof TaskError
					? err.message
					: `Unexpected error running task ${cyan(
							task.name,
					  )}. Canceling. If this is unexpected try running \`gro clean\`.`,
			),
			error: err,
		};
	}
	return {ok: true, output};
};
