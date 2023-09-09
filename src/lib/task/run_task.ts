import type {EventEmitter} from 'node:events';
import {cyan, red} from 'kleur/colors';
import {printLogLabel, SystemLogger} from '@feltjs/util/log.js';

import type {TaskModuleMeta} from './task_module.js';
import {TaskError} from './task.js';
import type {Args} from './args.js';
import type {invoke_task as base_invoke_task} from './invoke_task.js';
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
	task_meta: TaskModuleMeta,
	unparsed_args: Args,
	events: EventEmitter,
	invoke_task: typeof base_invoke_task,
): Promise<RunTaskResult> => {
	const {task} = task_meta.mod;
	const log = new SystemLogger(printLogLabel(task_meta.name));

	if (unparsed_args.help) {
		log_task_help(log, task_meta);
		return {ok: true, output: null};
	}

	let args = unparsed_args; // may be reassigned to parsed version ahead

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
			args,
			events,
			log,
			invoke_task: (invoked_task_name, invoked_args = {}, invoked_events = events) =>
				invoke_task(invoked_task_name, invoked_args as Args, invoked_events), // TODO typecast
		});
	} catch (err) {
		return {
			ok: false,
			reason: red(
				err?.constructor?.name === 'TaskError'
					? (err.message as string)
					: `Unexpected error running task ${cyan(
							task_meta.name,
					  )}. If this is unexpected try running \`gro clean\`.`,
			),
			error: err,
		};
	}
	return {ok: true, output};
};
