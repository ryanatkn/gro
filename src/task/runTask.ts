import type {EventEmitter} from 'events';
import {cyan, red} from 'kleur/colors';
import {printLogLabel, SystemLogger} from '@feltcoop/util';

import type {TaskModuleMeta} from './taskModule.js';
import {TaskError} from './task.js';
import type {Args} from '../utils/args.js';
import type {invokeTask as InvokeTaskFunction} from './invokeTask.js';
import type {Filesystem} from '../fs/filesystem.js';
import {logTaskHelp} from './logTask.js';

export type RunTaskResult =
	| {
			ok: true;
			output: unknown;
	  }
	| {
			ok: false;
			reason: string;
			error: Error;
	  };

export const runTask = async (
	fs: Filesystem,
	taskMeta: TaskModuleMeta,
	unparsedArgs: Args,
	events: EventEmitter,
	invokeTask: typeof InvokeTaskFunction,
): Promise<RunTaskResult> => {
	const {task} = taskMeta.mod;
	const log = new SystemLogger(printLogLabel(taskMeta.name));
	const dev = process.env.NODE_ENV !== 'production'; // TODO should this use `fromEnv`? '$app/env'?
	if (dev && task.production) {
		throw new TaskError(`The task "${taskMeta.name}" cannot be run in development`);
	}
	if (unparsedArgs.help) {
		logTaskHelp(log, taskMeta);
		return {ok: true, output: null};
	}

	let args = unparsedArgs; // may be reassigned to parsed version ahead

	// Parse and validate args.
	if (task.Args) {
		const parsed = task.Args.safeParse(args);
		if (parsed.success) {
			args = parsed.data;
		} else {
			const formatted = parsed.error.format();
			log.error(
				red(`Args validation failed:`),
				...formatted._errors.map((e) => '\n\n' + red(e)),
				'\n\n',
			);
			throw new TaskError(`Task args failed validation`);
		}
	}

	// Run the task.
	let output: unknown;
	try {
		output = await task.run({
			fs,
			dev,
			args,
			events,
			log,
			invokeTask: (invokedTaskName, invokedArgs = {}, invokedEvents = events, invokedFs = fs) =>
				invokeTask(invokedFs, invokedTaskName, invokedArgs as Args, invokedEvents), // TODO typecast
		});
	} catch (err) {
		return {
			ok: false,
			reason: red(
				err instanceof TaskError
					? err.message
					: `Unexpected error running task ${cyan(
							taskMeta.name,
					  )}. If this is unexpected try running \`gro clean\`.`,
			),
			error: err,
		};
	}
	return {ok: true, output};
};
