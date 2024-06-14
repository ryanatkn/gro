import type {Logger} from '@ryanatkn/belt/log.js';
import {strip_end} from '@ryanatkn/belt/string.js';
import type {z} from 'zod';
import type {Timings} from '@ryanatkn/belt/timings.js';

import type {Args} from './args.js';
import {import_id_to_lib_path, type Source_Id} from './paths.js';
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

// TODO BLOCK use task root paths? what's the right behavior?
export const to_task_name = (id: Source_Id): string => {
	const lib_path = import_id_to_lib_path(id);
	const name = strip_end(strip_end(lib_path, TASK_FILE_SUFFIX_TS), TASK_FILE_SUFFIX_JS);
	return name;
};

/**
 * This is used by tasks to signal a known failure.
 * It's useful for cleaning up logging because
 * we usually don't need their stack trace.
 */
export class Task_Error extends Error {}
