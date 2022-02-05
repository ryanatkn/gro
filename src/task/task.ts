import type StrictEventEmitter from 'strict-event-emitter-types';
import {type EventEmitter} from 'events';
import {type Logger} from '@feltcoop/felt/util/log.js';
import {type JSONSchema} from '@ryanatkn/json-schema-to-typescript';

import {type Filesystem} from '../fs/filesystem.js';

export interface Task<TArgs = Args, TEvents = {}> {
	run: (ctx: TaskContext<TArgs, TEvents>) => Promise<unknown>; // TODO return value (make generic, forward it..how?)
	summary?: string;
	production?: boolean;
	args?: ArgsSchema;
}

export interface TaskContext<TArgs = {}, TEvents = {}> {
	fs: Filesystem;
	dev: boolean;
	log: Logger;
	args: TArgs;
	events: StrictEventEmitter<EventEmitter, TEvents>;
	// TODO could lookup `Args` based on a map of `taskName` types (codegen to keep it simple?)
	invokeTask: (
		taskName: string,
		args?: Args,
		events?: StrictEventEmitter<EventEmitter, TEvents>,
		fs?: Filesystem,
	) => Promise<void>;
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

// These extend the CLI args for tasks.
// Anything can be assigned to a task's `args`. It's just a mutable POJO dictionary.
// Downstream tasks will see args that upstream events mutate,
// unless `invokeTask` is called with modified args.
// Upstream tasks can use listeners to respond to downstream events and values.
// It's a beautiful mutable spaghetti mess. cant get enough
// The raw CLI ares are handled by `mri` - https://github.com/lukeed/mri
export interface Args {
	_: string[];
	[key: string]: unknown; // can assign anything to `args` in tasks
}

export const serializeArgs = (args: Args): string[] => {
	const result: string[] = [];
	let _: string[] | null = null;
	for (const [key, value] of Object.entries(args)) {
		if (key === '_') {
			_ = (value as any[]).map((v) => (v === undefined ? '' : v + ''));
		} else {
			result.push(`${key.length === 1 ? '-' : '--'}${key}`);
			if (value !== undefined) result.push((value as any) + '');
		}
	}
	return _ ? [...result, ..._] : result;
};

export type ArgsProperties = Record<string, ArgSchema> & {
	_?: {type: 'array'; items: {type: 'string'}; default: []};
};

// TODO should this extend `VocabSchema` so we get `$id`?
export interface ArgsSchema extends JSONSchema {
	type: 'object';
	properties: ArgsProperties;
}

export interface ArgSchema extends JSONSchema {
	type: 'boolean' | 'string' | 'number' | 'array';
	// TODO how to use this?
	default: boolean | string | number | any[];
}
