import {styleText as st} from 'node:util';
import {print_log_label} from '@ryanatkn/belt/print.js';
import {System_Logger} from '@ryanatkn/belt/log.js';
import type {Timings} from '@ryanatkn/belt/timings.js';

import {parse_args, type Args} from './args.ts';
import type {invoke_task as base_invoke_task} from './invoke_task.ts';
import {log_task_help} from './task_logging.ts';
import type {Gro_Config} from './gro_config.ts';
import {Task_Error, type Task_Module_Meta} from './task.ts';
import {default_svelte_config} from './svelte_config.ts';
import type {Filer} from './filer.ts';

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
	filer: Filer,
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
			log.error(st('red', `Args validation failed:`), '\n', parsed.error.format());
			throw new Task_Error(`Task args failed validation`);
		}
		args = parsed.data;
	}

	// Run the task.
	let output: unknown; // TODO generic
	try {
		output = await task.run({
			args,
			config,
			svelte_config: default_svelte_config,
			filer,
			log,
			timings,
			invoke_task: (invoked_task_name, invoked_args, invoked_config) =>
				invoke_task(invoked_task_name, invoked_args, invoked_config ?? config, filer, timings),
		});
	} catch (err) {
		return {
			ok: false,
			reason: st(
				'red',
				err?.constructor?.name === 'Task_Error'
					? (err.message as string)
					: `Unexpected error running task ${st(
							'cyan',
							task_meta.name,
						)}. If this is unexpected try running \`${config.pm_cli} install\` and \`gro clean\`.`,
			),
			error: err,
		};
	}
	return {ok: true, output};
};
