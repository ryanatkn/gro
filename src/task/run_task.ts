import type {EventEmitter} from 'events';
import {cyan, red} from '@feltcoop/felt/utils/terminal.js';
import {print_log_label, System_Logger} from '@feltcoop/felt/utils/log.js';

import type {TaskModule_Meta} from './task_module.js';
import type {Args} from './task.js';
import {Task_Error} from './task.js';
import type {invoke_task as InvokeTaskFunction} from './invoke_task.js';
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
	task: TaskModule_Meta,
	args: Args,
	events: EventEmitter,
	invoke_task: typeof InvokeTaskFunction,
	dev: boolean | undefined, // `undefined` on first task invocation, so it infers from the first task
): Promise<RunTaskResult> => {
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
			log: new System_Logger(print_log_label(task.name)),
			invoke_task: (
				invokedTaskName,
				invokedArgs = args,
				invokedEvents = events,
				invokedDev = dev,
				invokedFs = fs,
			) => invoke_task(invokedFs, invokedTaskName, invokedArgs, invokedEvents, invokedDev),
		});
	} catch (err) {
		return {
			ok: false,
			reason: red(
				err instanceof Task_Error
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
