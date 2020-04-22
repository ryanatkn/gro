import {Logger} from '../utils/log.js';
import {Args} from '../bin/types.js';

export interface Task<T = unknown> {
	run: (ctx: TaskContext) => Promise<T>;
	description?: string;
}

export interface TaskModuleMeta {
	id: string;
	name: string;
	mod: TaskModule;
}

export interface TaskContext {
	log: Logger;
	args: Args;
}

export interface TaskModule {
	task: Task;
}

export const TASK_FILE_PATTERN = /\.task\.ts$/;
export const TASK_FILE_SUFFIX = '.task.ts';

export const isTaskPath = (path: string): boolean =>
	TASK_FILE_PATTERN.test(path);

export const toTaskPath = (taskName: string): string =>
	taskName + TASK_FILE_SUFFIX;

export const toTaskName = (path: string): string =>
	path.replace(TASK_FILE_PATTERN, '');

export const validateTaskModule = (mod: Obj): mod is TaskModule =>
	!!mod.task && typeof mod.task.run === 'function';
