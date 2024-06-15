import type {Logger} from '@ryanatkn/belt/log.js';
import {strip_end, strip_start} from '@ryanatkn/belt/string.js';
import type {z} from 'zod';
import type {Timings} from '@ryanatkn/belt/timings.js';

import type {Args} from './args.js';
import type {Source_Id} from './paths.js';
import type {Gro_Config} from './config.js';

export interface Task<
	T_Args = Args, // same as `z.infer<typeof Args>`
	T_Args_Schema extends z.ZodType = z.ZodType,
	T_Return = unknown,
> {
	run: (ctx: Task_Context<T_Args>) => Promise<T_Return>; // TODO return value (make generic, forward it..how?)
	summary?: string;
	Args?: T_Args_Schema;
}

export interface Task_Context<T_Args = object> {
	args: T_Args;
	config: Gro_Config;
	// TODO should this go here or on `config` for convenience?
	// sveltekit_config: Parsed_Sveltekit_Config;
	log: Logger;
	timings: Timings;
	invoke_task: (task_name: string, args?: Args, config?: Gro_Config) => Promise<void>;
}

export const TASK_FILE_SUFFIX_TS = '.task.ts';
export const TASK_FILE_SUFFIX_JS = '.task.js';

export const is_task_path = (path: string): boolean =>
	path.endsWith(TASK_FILE_SUFFIX_TS) || path.endsWith(TASK_FILE_SUFFIX_JS);

export const to_task_name = (id: Source_Id, task_root_paths: string[]): string => {
	let base_path = id;
	// If the id is in any of the task root paths, use the first match and strip it.
	for (const task_root_path of task_root_paths) {
		if (id.startsWith(task_root_path)) {
			base_path = strip_start(strip_start(id, task_root_path), '/');
			break;
		}
	}
	return strip_end(strip_end(base_path, TASK_FILE_SUFFIX_TS), TASK_FILE_SUFFIX_JS);
};

/**
 * This is used by tasks to signal a known failure.
 * It's useful for cleaning up logging because
 * we usually don't need their stack trace.
 */
export class Task_Error extends Error {}
