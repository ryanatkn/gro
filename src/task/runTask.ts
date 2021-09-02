import type {EventEmitter} from 'events';
import {cyan, red} from '@feltcoop/felt/util/terminal.js';
import {printLogLabel, SystemLogger} from '@feltcoop/felt/util/log.js';

import type {TaskModuleMeta} from 'src/task/taskModule.js';
import type {Args} from 'src/task/task.js';
import {TaskError} from './task.js';
import type {invokeTask as InvokeTaskFunction} from 'src/task/invokeTask.js';
import type {Filesystem} from 'src/fs/filesystem.js';

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
	taskMeta: TaskModuleMeta,
	args: Args,
	events: EventEmitter,
	invokeTask: typeof InvokeTaskFunction,
	dev: boolean | undefined, // `undefined` on first task invocation, so it infers from the first task
): Promise<RunTaskResult> => {
	const {task} = taskMeta.mod;
	if (dev === undefined) {
		if (task.dev !== undefined) {
			dev = task.dev;
		} else {
			dev = process.env.NODE_ENV !== 'production';
		}
	}
	// TODO the `=== false` is needed because we're not normalizing tasks, but we probably should,
	// but not in this function, when the task is loaded
	if (dev && task.dev === false) {
		throw new TaskError(`The task "${taskMeta.name}" cannot be run in development`);
	}
	let output: unknown;
	try {
		output = await task.run({
			fs,
			dev,
			args,
			events,
			log: new SystemLogger(printLogLabel(taskMeta.name)),
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
							taskMeta.name,
					  )}. If this is unexpected try running \`gro clean\`.`,
			),
			error: err,
		};
	}
	return {ok: true, output};
};
