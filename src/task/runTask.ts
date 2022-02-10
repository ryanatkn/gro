import {type EventEmitter} from 'events';
import {cyan, red} from 'kleur/colors';
import {printLogLabel, SystemLogger} from '@feltcoop/felt/util/log.js';

import {type TaskModuleMeta} from './taskModule.js';
import {TaskError, type Args} from './task.js';
import {type invokeTask as InvokeTaskFunction} from './invokeTask.js';
import {type Filesystem} from '../fs/filesystem.js';
import {logTaskHelp} from './logTask.js';
import {ajv, validateSchema} from '../utils/ajv.js';

ajv({useDefaults: true});

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
	args: Args,
	events: EventEmitter,
	invokeTask: typeof InvokeTaskFunction,
): Promise<RunTaskResult> => {
	const {task} = taskMeta.mod;
	const log = new SystemLogger(printLogLabel(taskMeta.name));
	const dev = process.env.NODE_ENV !== 'production'; // TODO should this use `fromEnv`? '$app/env'?
	if (dev && task.production) {
		throw new TaskError(`The task "${taskMeta.name}" cannot be run in development`);
	}
	if (args.help) {
		logTaskHelp(log, taskMeta);
		return {ok: true, output: null};
	}

	// Parse and validate args.
	if (task.args) {
		const validate = validateSchema(task.args);
		validate(args);
		if (validate.errors) {
			const count = validate.errors.length;
			log.error(
				red(`Args validation failed:`),
				...validate.errors.flatMap((e, i) => [red(`\nerror${count > 1 ? ' ' + i : ''}:`), e]),
			);
			throw new TaskError(`Task args failed validation.`);
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
			invokeTask: (invokedTaskName, invokedArgs = args, invokedEvents = events, invokedFs = fs) =>
				invokeTask(invokedFs, invokedTaskName, invokedArgs, invokedEvents),
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
