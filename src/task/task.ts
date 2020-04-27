import {Logger} from '../utils/log.js';
import {Args} from '../cli/types.js';

export interface Task<T = unknown> {
	run: (ctx: TaskContext) => Promise<T>;
	description?: string;
}

export interface TaskContext {
	log: Logger;
	args: Args;
}

export const TASK_FILE_PATTERN = /\.task\.ts$/;
export const TASK_FILE_SUFFIX = '.task.ts';

export const isTaskPath = (path: string): boolean =>
	TASK_FILE_PATTERN.test(path);

export const toTaskPath = (taskName: string): string =>
	taskName + TASK_FILE_SUFFIX;

export const toTaskName = (basePath: string): string =>
	basePath.replace(TASK_FILE_PATTERN, '');
