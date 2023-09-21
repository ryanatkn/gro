import {cyan, red} from 'kleur/colors';
import {printLogLabel, SystemLogger} from '@grogarden/util/log.js';
import type {Timings} from '@grogarden/util/timings.js';

import type {TaskModuleMeta} from './task_module.js';
import {parse_args, type Args} from './args.js';
import type {invoke_task as base_invoke_task} from './invoke_task.js';
import {print_task_help} from './print_task.js';
import type {GroConfig} from './config.js';
import {TaskError} from './task.js';

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
	invoke_task: typeof base_invoke_task,
	config: GroConfig,
	timings: Timings,
): Promise<RunTaskResult> => {
	const {task} = task_meta.mod;
	const log = new SystemLogger(printLogLabel(task_meta.name));

	if (unparsed_args.help) {
		print_task_help(log, task_meta);
		return {ok: true, output: null};
	}

	// Parse and validate args.
	let args = unparsed_args;
	if (task.Args) {
		const parsed = parse_args(unparsed_args, task.Args);
		if (!parsed.success) {
			log.error(red(`Args validation failed:`), '\n', parsed.error.format());
			throw new TaskError(`Task args failed validation`);
		}
		args = parsed.data;
	}

	// Run the task.
	let output: unknown;
	try {
		output = await task.run({
			args,
			config,
			log,
			timings,
			invoke_task: (invoked_task_name, invoked_args = {}, invoked_config) =>
				invoke_task(invoked_task_name, invoked_args, invoked_config || config, timings),
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
