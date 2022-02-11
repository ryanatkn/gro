import type StrictEventEmitter from 'strict-event-emitter-types';
import {type EventEmitter} from 'events';
import {type Logger} from '@feltcoop/felt/util/log.js';
import {stripEnd} from '@feltcoop/felt/util/string.js';
import {type JSONSchema} from '@ryanatkn/json-schema-to-typescript';
import mri from 'mri';

import {type Filesystem} from '../fs/filesystem.js';

export interface Task<TArgs = Args, TEvents = object> {
	run: (ctx: TaskContext<TArgs, TEvents>) => Promise<unknown>; // TODO return value (make generic, forward it..how?)
	summary?: string;
	production?: boolean;
	args?: ArgsSchema;
}

export interface TaskContext<TArgs = object, TEvents = object> {
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

export const TASK_FILE_SUFFIX = '.task.ts';

export const isTaskPath = (path: string): boolean => path.endsWith(TASK_FILE_SUFFIX);

export const toTaskName = (basePath: string): string => {
	const stripped = stripEnd(basePath, TASK_FILE_SUFFIX);
	if (stripped === basePath) return basePath;
	// Handle task directories, so `a/a.task` outputs `a` instead of `a/a`.
	const s = stripped.split('/');
	return s[s.length - 1] === s[s.length - 2] ? s.slice(0, -1).join('/') : stripped;
};

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
	_?: string[];
	help?: boolean;
	[key: string]: string | number | boolean | undefined | string[];
}

export const serializeArgs = (args: Args): string[] => {
	const result: string[] = [];
	let _: string[] | null = null;
	for (const [key, value] of Object.entries(args)) {
		if (key === '_') {
			_ = value ? (value as any[]).map((v) => (v === undefined ? '' : v + '')) : [];
		} else {
			result.push(`${key.length === 1 ? '-' : '--'}${key}`);
			if (value !== undefined && typeof value !== 'boolean') {
				result.push((value as any) + '');
			}
		}
	}
	return _ ? [...result, ..._] : result;
};

// TODO allow schema composition with things like `allOf` instead of requiring properties
// TODO should this extend `VocabSchema` so we get `$id`?
export interface ArgsSchema extends JSONSchema {
	type: 'object';
	properties: ArgsProperties;
}

export type ArgsProperties = Record<string, ArgSchema> & {
	_?: {
		type: 'array';
		items: {type: 'string'};
		default: any[] | undefined;
		description: string;
	} & JSONSchema;
};

export interface ArgSchema extends JSONSchema {
	type: 'boolean' | 'string' | 'number' | 'array';
	default: boolean | string | number | any[] | undefined;
	description: string;
}

/**
 * Parses `taskName` and `args` from `process.argv` using `mri`,
 * ignoring anything after any `--`.
 */
export const toTaskArgs = (): {taskName: string; args: Args} => {
	const {argv} = process;
	const forwardedIndex = argv.indexOf('--');
	const args = mri(forwardedIndex === -1 ? argv.slice(2) : argv.slice(2, forwardedIndex));
	const taskName = args._.shift() || '';
	if (args._.length === 0) delete (args as Args)._; // enable schema defaults
	return {taskName, args};
};

/**
 * Parses `process.argv` for the specified `command`, so given
 * `gro taskname arg1 --arg2 -- eslint eslintarg1 --eslintarg2 -- tsc --tscarg1 --tscarg2`
 * the `command` `'eslint'` returns `eslintarg1 --eslintarg2`
 * and `'tsc'` returns `--tscarg1` and `--tscarg2`.
 */
export const toForwardedArgs = (command: string): Args => toForwardedArgsByCommand()[command] || {};

let _forwardedArgsByCommand: Record<string, Args> | undefined;

export const toForwardedArgsByCommand = (reset = false): Record<string, Args> => {
	if (reset) _forwardedArgsByCommand = undefined;
	if (_forwardedArgsByCommand) return _forwardedArgsByCommand;
	// Parse each segment of `argv` separated by `--`.
	const argvs: string[][] = [];
	let arr: string[] | undefined;
	for (const a of process.argv) {
		if (a === '--') {
			if (arr?.length) argvs.push(arr);
			arr = [];
		} else if (!arr) {
			continue;
		} else {
			arr.push(a);
		}
	}
	if (arr?.length) argvs.push(arr);
	// Add each segment of parsed `argv` keyed by the first rest arg,
	// which is assumed to be the CLI command that gets forwarded the args.
	_forwardedArgsByCommand = {};
	for (const argv of argvs) {
		const args = mri(argv);
		const command = args._.shift();
		if (!command) {
			throw Error(
				`Malformed args following a \`--\`. Expected a rest arg command: \`${argv.join(' ')}\``,
			);
		}
		if (!args._.length) delete (args as Args)._;
		_forwardedArgsByCommand[command] = args;
	}
	return _forwardedArgsByCommand;
};
