import type {Logger} from '../utils/log.js';

export interface Task<TArgs = Args> {
	run: (ctx: TaskContext<TArgs>) => Promise<unknown>;
	description?: string;
	dev?: boolean;
}

// These extend the CLI args for tasks.
// Anything can be assigned to a task's `args`. It's just a mutable POJO dictionary.
// Downstream tasks will see args that upstream events mutate,
// unless `invokeTask` is called with modified args.
// Upstream tasks can use hooks to respond to downstream events and values.
// It's a beautiful mutable spaghetti mess. cant get enough
// The raw CLI ares are handled by `mri` - https://github.com/lukeed/mri
export interface Args {
	_: string[];
	[key: string]: any; // can assign anything to `args` in tasks
}

export interface TaskContext<TArgs = Args> {
	dev: boolean;
	log: Logger;
	args: TArgs;
	// TODO could lookup `Args` based on a map of `taskName` types (codegen to keep it simple?)
	invokeTask: (taskName: string, args?: Args, dev?: boolean) => Promise<void>;
}

export const TASK_FILE_PATTERN = /\.task\.ts$/;
export const TASK_FILE_SUFFIX = '.task.ts';

export const isTaskPath = (path: string): boolean => TASK_FILE_PATTERN.test(path);

export const toTaskPath = (taskName: string): string => taskName + TASK_FILE_SUFFIX;

export const toTaskName = (basePath: string): string => basePath.replace(TASK_FILE_PATTERN, '');

// This is used by tasks to signal a known failure.
// It's useful for cleaning up logging because
// we usually don't need their stack trace.
export class TaskError extends Error {}
