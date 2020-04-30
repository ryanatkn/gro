import {SystemLogger} from '../utils/log.js';
import {cyan, magenta, red} from '../colors/terminal.js';
import {TaskModuleMeta} from './taskModule.js';
import {Args, Env} from '../cli/types.js';

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
	env: Env,
): Promise<RunTaskResult> => {
	let output;
	try {
		output = await task.mod.task.run({
			args,
			env,
			log: new SystemLogger([magenta(`[task:${cyan(task.name)}]`)]),
		});
	} catch (err) {
		return {
			ok: false,
			reason: red(
				`Unexpected error running task ${cyan(task.name)}. Aborting.`,
			),
			error: err,
		};
	}
	return {ok: true, output};
};
