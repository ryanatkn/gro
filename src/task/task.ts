import {Logger} from '../utils/log.js';
import {Args, Env} from '../cli/types.js';

export interface Task<T = unknown> {
	run: (ctx: TaskContext) => Promise<T>;
	description?: string;
}

export interface TaskContext {
	log: Logger;
	args: Args;
	env: Env;
}

export const TASK_FILE_PATTERN = /\.task\.ts$/;
export const TASK_FILE_SUFFIX = '.task.ts';

export const isTaskPath = (path: string): boolean =>
	TASK_FILE_PATTERN.test(path);

export const toTaskPath = (taskName: string): string =>
	taskName + TASK_FILE_SUFFIX;

export const toTaskName = (basePath: string): string =>
	basePath.replace(TASK_FILE_PATTERN, '');

// This is used by tasks to signal a known failure.
// It's useful for cleaning up logging because
// we usually don't need their stack trace.
export class TaskError extends Error {}
