import type {EventEmitter} from 'node:events';
import {cyan, red} from 'kleur/colors';
import {printLogLabel, SystemLogger} from '@feltjs/util/log.js';

import type {TaskModuleMeta} from './task_module.js';
import {TaskError} from './task.js';
import type {Args} from './args.js';
import type {invoke_task as defaultInvokeTask} from './invoke_task.js';
import type {Filesystem} from '../fs/filesystem.js';
import {log_task_help} from './log_task.js';

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

export const run_task = async (
	fs: Filesystem,
	taskMeta: TaskModuleMeta,
	unparsedArgs: Args,
	events: EventEmitter,
	invoke_task: typeof defaultInvokeTask,
): Promise<RunTaskResult> => {
	const {task} = taskMeta.mod;
	const log = new SystemLogger(printLogLabel(taskMeta.name));

	if (unparsedArgs.help) {
		log_task_help(log, taskMeta);
		return {ok: true, output: null};
	}

	let args = unparsedArgs; // may be reassigned to parsed version ahead

	// Parse and validate args.
	if (task.Args) {
		const parsed = task.Args.safeParse(args);
		if (parsed.success) {
			args = parsed.data;
		} else {
			// TODO this is really messy
			log.error(red(`Args validation failed:`), '\n', parsed.error.format());
			throw new TaskError(`Task args failed validation`);
		}
	}

	// Run the task.
	let output: unknown;
	try {
		output = await task.run({
			fs,
			args,
			events,
			log,
			invoke_task: (invokedTaskName, invokedArgs = {}, invokedEvents = events, invokedFs = fs) =>
				invoke_task(invokedFs, invokedTaskName, invokedArgs as Args, invokedEvents), // TODO typecast
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
