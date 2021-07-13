import type {EventEmitter} from 'events';
import {cyan, red} from '@feltcoop/felt/util/terminal.js';
import {print_log_label, System_Logger} from '@feltcoop/felt/util/log.js';

import type {Task_Module_Meta} from 'src/task/task_module.js';
import type {Args} from 'src/task/task.js';
import {Task_Error} from './task.js';
import type {invoke_task as Invoke_Task_Function} from 'src/task/invoke_task.js';
import type {Filesystem} from 'src/fs/filesystem.js';

export type Run_Task_Result =
	| {
			ok: true;
			output: unknown;
	  }
	| {
			ok: false;
			reason: string;
			error: Error;
	  };

export const run_task = async (
	fs: Filesystem,
	task_meta: Task_Module_Meta,
	args: Args,
	events: EventEmitter,
	invoke_task: typeof Invoke_Task_Function,
	dev: boolean | undefined, // `undefined` on first task invocation, so it infers from the first task
): Promise<Run_Task_Result> => {
	const {task} = task_meta.mod;
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
		throw new Task_Error(`The task "${task_meta.name}" cannot be run in development`);
	}
	let output: unknown;
	try {
		output = await task.run({
			fs,
			dev,
			args,
			events,
			log: new System_Logger(print_log_label(task_meta.name)),
			invoke_task: (
				invoked_task_name,
				invoked_args = args,
				invoked_events = events,
				invoked_dev = dev,
				invoked_fs = fs,
			) => invoke_task(invoked_fs, invoked_task_name, invoked_args, invoked_events, invoked_dev),
		});
	} catch (err) {
		return {
			ok: false,
			reason: red(
				err instanceof Task_Error
					? err.message
					: `Unexpected error running task ${cyan(
							task_meta.name,
					  )}. If this is unexpected try running \`gro clean\`.`,
			),
			error: err,
		};
	}
	return {ok: true, output};
};
