import {Logger} from '../utils/log.js';
import {Argv} from '../bin/types.js';

export interface Task {
	run: (ctx: TaskContext, data: TaskData) => Promise<TaskData | void>;
}

export interface TaskMeta {
	task: Task;
	name: string;
	path: string;
}

export interface TaskData {
	[key: string]: any;
}

export interface TaskContext {
	log: Logger;
	argv: Argv;
}

export interface TaskModule {
	task: Task;
}

export const TASK_FILE_PATTERN = /\.task\.js$/;
export const TASK_FILE_SUFFIX = '.task.js';

export const isTaskPath = (path: string): boolean =>
	TASK_FILE_PATTERN.test(path);

export const toTaskPath = (taskName: string): string =>
	taskName + TASK_FILE_SUFFIX;

export const toTaskName = (path: string): string =>
	path.replace(TASK_FILE_PATTERN, '');

export const validateTaskModule = (mod: any): mod is TaskModule =>
	!!mod.task && typeof mod.task.run === 'function';
