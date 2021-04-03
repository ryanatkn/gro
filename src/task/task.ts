import type {Logger} from '../utils/log.js';
import type {Args} from '../cli/types.js';

export interface Task {
	run: (ctx: TaskContext) => Promise<unknown>;
	description?: string;
	dev?: boolean;
}

export interface TaskContext {
	dev: boolean;
	log: Logger;
	args: Args;
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
