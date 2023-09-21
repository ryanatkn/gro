import type {Logger} from '@grogarden/util/log.js';
import {stripEnd} from '@grogarden/util/string.js';
import type {z} from 'zod';
import type {Timings} from '@grogarden/util/timings.js';

import type {Args} from '../task/args.js';
import {import_id_to_lib_path, type SourceId} from '../util/paths.js';
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

export const to_task_name = (id: SourceId): string => {
	const lib_path = import_id_to_lib_path(id);
	const name = stripEnd(stripEnd(lib_path, TASK_FILE_SUFFIX_TS), TASK_FILE_SUFFIX_JS);
	return name;
};

/**
 * This is used by tasks to signal a known failure.
 * It's useful for cleaning up logging because
 * we usually don't need their stack trace.
 */
export class TaskError extends Error {}
