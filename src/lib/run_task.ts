import {cyan, red} from '@ryanatkn/belt/styletext.js';
import {print_log_label, System_Logger} from '@ryanatkn/belt/log.js';
import type {Timings} from '@ryanatkn/belt/timings.js';

import {parse_args, type Args} from './args.js';
import type {invoke_task as base_invoke_task} from './invoke_task.js';
import {log_task_help} from './task_logging.js';
import type {Gro_Config} from './gro_config.js';
import {Task_Error, type Task_Module_Meta} from './task.js';
import {default_sveltekit_config} from './sveltekit_config.js';

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
	task_meta: Task_Module_Meta,
	unparsed_args: Args,
	invoke_task: typeof base_invoke_task,
	config: Gro_Config,
	timings: Timings,
): Promise<Run_Task_Result> => {
	const {task} = task_meta.mod;
	const log = new System_Logger(print_log_label(task_meta.name));

	if (unparsed_args.help) {
		log_task_help(log, task_meta);
		return {ok: true, output: null};
	}

	// Parse and validate args.
	let args = unparsed_args;
	if (task.Args) {
		const parsed = parse_args(unparsed_args, task.Args);
		if (!parsed.success) {
			log.error(red(`Args validation failed:`), '\n', parsed.error.format());
			throw new Task_Error(`Task args failed validation`);
		}
		args = parsed.data;
	}

	// Run the task.
	let output: unknown;
	try {
		output = await task.run({
			args,
			config,
			sveltekit_config: default_sveltekit_config,
			log,
			timings,
			invoke_task: (invoked_task_name, invoked_args, invoked_config) =>
				invoke_task(invoked_task_name, invoked_args, invoked_config ?? config, timings),
		});
	} catch (err) {
		return {
			ok: false,
			reason: red(
				err?.constructor?.name === 'Task_Error'
					? (err.message as string)
					: `Unexpected error running task ${cyan(
							task_meta.name,
						)}. If this is unexpected try running \`npm i\` and \`gro clean\`.`,
			),
			error: err,
		};
	}
	return {ok: true, output};
};
