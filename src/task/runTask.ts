import {cyan, magenta, red, gray} from '../utils/terminal.js';
import {SystemLogger} from '../utils/log.js';
import type {TaskModuleMeta} from './taskModule.js';
import type {Args} from './task.js';
import {TaskError} from './task.js';

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
	task: TaskModuleMeta,
	args: Args,
	invokeTask: (taskName: string, args: Args, dev: boolean) => Promise<void>,
	dev?: boolean,
): Promise<RunTaskResult> => {
	if (dev === undefined) {
		if (task.mod.task.dev !== undefined) {
			dev = task.mod.task.dev;
			process.env.NODE_ENV = dev ? 'development' : 'production';
		} else {
			dev = process.env.NODE_ENV !== 'production';
		}
	}
	let output;
	try {
		output = await task.mod.task.run({
			dev,
			args,
			log: new SystemLogger([`${gray('[')}${magenta(task.name)}${gray(':log')}${gray(']')}`]),
			invokeTask: (invokedTaskName, invokedArgs = args, invokedDev = dev!) =>
				invokeTask(invokedTaskName, invokedArgs, invokedDev),
		});
	} catch (err) {
		return {
			ok: false,
			reason: red(
				err instanceof TaskError
					? err.message
					: `Unexpected error running task ${cyan(
							task.name,
					  )}. Aborting. If this is unexpected try running \`gro clean\`.`,
			),
			error: err,
		};
	}
	return {ok: true, output};
};
