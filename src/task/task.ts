import type StrictEventEmitter from 'strict-event-emitter-types';
import type {EventEmitter} from 'events';
import type {Logger} from '@feltcoop/felt/util/log.js';

import type {Filesystem} from 'src/fs/filesystem.js';

export interface Task<TArgs = Args, TEvents = {}> {
	run: (ctx: TaskContext<TArgs, TEvents>) => Promise<unknown>; // TODO return value (make generic, forward it..how?)
	summary?: string;
	dev?: boolean;
}

export interface TaskContext<TArgs = {}, TEvents = {}> {
	fs: Filesystem;
	dev: boolean;
	log: Logger;
	args: TArgs;
	events: StrictEventEmitter<EventEmitter, TEvents>;
	// TODO could lookup `Args` based on a map of `task_name` types (codegen to keep it simple?)
	invoke_task: (
		task_name: string,
		args?: Args,
		events?: StrictEventEmitter<EventEmitter, TEvents>,
		dev?: boolean,
		fs?: Filesystem,
	) => Promise<void>;
}

export const TASK_FILE_PATTERN = /\.task\.ts$/;
export const TASK_FILE_SUFFIX = '.task.ts';

export const is_task_path = (path: string): boolean => TASK_FILE_PATTERN.test(path);

export const to_task_path = (task_name: string): string => task_name + TASK_FILE_SUFFIX;

export const to_task_name = (base_path: string): string => base_path.replace(TASK_FILE_PATTERN, '');

// This is used by tasks to signal a known failure.
// It's useful for cleaning up logging because
// we usually don't need their stack trace.
export class TaskError extends Error {}

// These extend the CLI args for tasks.
// Anything can be assigned to a task's `args`. It's just a mutable POJO dictionary.
// Downstream tasks will see args that upstream events mutate,
// unless `invoke_task` is called with modified args.
// Upstream tasks can use listeners to respond to downstream events and values.
// It's a beautiful mutable spaghetti mess. cant get enough
// The raw CLI ares are handled by `mri` - https://github.com/lukeed/mri
export interface Args {
	_: string[];
	[key: string]: unknown; // can assign anything to `args` in tasks
}
