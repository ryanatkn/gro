import type {Logger} from '@feltjs/util/log.js';
import {stripEnd, stripStart} from '@feltjs/util/string.js';
import type {z} from 'zod';
import type {Timings} from '@feltjs/util/timings.js';

import type {Args} from '../task/args.js';
import {LIB_DIRNAME} from '../util/paths.js';
import type {GroConfig} from '../config/config.js';

export interface Task<
	TArgs = Args, // same as `z.infer<typeof Args>`
	TArgsSchema extends z.ZodType = z.ZodType,
	TReturn = unknown,
> {
	run: (ctx: TaskContext<TArgs>) => Promise<TReturn>; // TODO return value (make generic, forward it..how?)
	summary?: string;
	Args?: TArgsSchema;
}

export interface TaskContext<TArgs = object> {
	args: TArgs;
	config: GroConfig;
	log: Logger;
	timings: Timings;
	invoke_task: (task_name: string, args?: Args, config?: GroConfig) => Promise<void>;
}

export const TASK_FILE_SUFFIX_TS = '.task.ts';
export const TASK_FILE_SUFFIX_JS = '.task.js';

export const is_task_path = (path: string): boolean =>
	path.endsWith(TASK_FILE_SUFFIX_TS) || path.endsWith(TASK_FILE_SUFFIX_JS);

export const to_task_name = (base_path: string): string => {
	console.log(`[to_task_name] base_path`, base_path);
	const name = stripStart(
		stripEnd(stripEnd(base_path, TASK_FILE_SUFFIX_TS), TASK_FILE_SUFFIX_JS),
		LIB_DIRNAME + '/',
	);
	console.log(`[to_task_name] name`, name);
	return name;
};

/**
 * This is used by tasks to signal a known failure.
 * It's useful for cleaning up logging because
 * we usually don't need their stack trace.
 */
export class TaskError extends Error {}
