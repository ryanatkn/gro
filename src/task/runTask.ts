import {SystemLogger} from '../utils/log.js';
import {cyan, magenta, red, gray} from '../colors/terminal.js';
import {TaskModuleMeta} from './taskModule.js';
import {Args} from '../cli/types.js';
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
	invokeTask: (taskName: string, args: Args) => Promise<void>,
): Promise<RunTaskResult> => {
	let output;
	try {
		output = await task.mod.task.run({
			args,
			log: new SystemLogger([`${gray('[')}${magenta(task.name)}${gray(':log')}${gray(']')}`]),
			invokeTask: (invokedTaskName, invokedArgs = args) => invokeTask(invokedTaskName, invokedArgs),
		});
	} catch (err) {
		return {
			ok: false,
			reason: red(
				err instanceof TaskError
					? err.message
					: `Unexpected error running task ${cyan(task.name)}. Aborting.`,
			),
			error: err,
		};
	}
	return {ok: true, output};
};
