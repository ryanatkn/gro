import {join} from 'path';

import {SystemLogger} from '../utils/log.js';
import {cyan, magenta, red, yellow} from '../colors/terminal.js';
import {omitUndefined} from '../utils/object.js';
import {
	TaskModuleMeta,
	toTaskPath,
	toTaskName,
	validateTaskModule,
} from './task.js';
import {fmtMs, fmtError} from '../utils/fmt.js';
import {createStopwatch} from '../utils/time.js';
import {Args} from '../cli/types.js';
import {toBasePath, isSourceId} from '../paths.js';

export interface Options {
	host: RunHost;
	dir: string;
	taskName: string | undefined;
	args: Args;
}
export type RequiredOptions = 'host' | 'dir' | 'taskName' | 'args';
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => ({
	...omitUndefined(opts),
});

export interface RunHost {
	findTaskModules: (dir: string) => Promise<string[]>; // returns source ids
	loadTaskModule: (sourceId: string) => Promise<TaskModuleMeta>;
}

export type RunResult = {
	ok: boolean;
	taskName: string | undefined;
	loadResult: TaskLoadResult | undefined;
	runResult: TaskRunResult | undefined;
	elapsed: number;
};
export type TaskLoadResult =
	| {ok: true; taskName: string}
	| {ok: false; taskName: string; reason: string; error: Error};
export type TaskRunResult =
	| {ok: true; taskName: string; elapsed: number; result: unknown}
	| {ok: false; taskName: string; reason: string; error: Error};

export const run = async (opts: InitialOptions): Promise<RunResult> => {
	const options = initOptions(opts);
	const {host, dir, taskName, args} = options;
	const log = new SystemLogger([magenta('[run]')]);
	const {error, info} = log;

	// TODO is this right? or should we convert input paths to source ids?
	if (!isSourceId(dir)) {
		throw Error(`dir must be a source id: ${dir}`);
	}

	const mainStopwatch = createStopwatch();

	// If no task names are provided,
	// find all of the available ones and print them out.
	if (!taskName) {
		const taskSourceIds = await host.findTaskModules(dir);
		const taskNames = taskSourceIds.map(id => toTaskName(toBasePath(id)));
		if (taskNames.length) {
			info(
				'Available tasks:\n',
				taskNames.map(n => '\t\t' + cyan(n)).join('\n'),
			);
		} else {
			info('No tasks found.');
		}
		return {
			ok: true,
			taskName: undefined,
			loadResult: undefined,
			runResult: undefined,
			elapsed: mainStopwatch(),
		};
	}

	// First load all of the specified tasks,
	// so any errors cause the command to exit before running anything.
	// We don't want to run only some tasks in a series!
	let task: TaskModuleMeta;
	let loadResult: TaskLoadResult;
	const path = toTaskPath(taskName);
	const sourceId = join(dir, path);
	try {
		const rawTaskModule = await host.loadTaskModule(sourceId);
		if (!validateTaskModule(rawTaskModule.mod)) {
			throw Error(`Task module is invalid: ${toBasePath(sourceId)}`);
		}
		task = rawTaskModule;
		loadResult = {ok: true, taskName};
	} catch (err) {
		const reason = `Failed to load task "${taskName}".`;
		error(red(reason), yellow(err.message));
		return {
			ok: false,
			taskName,
			loadResult: {ok: false, taskName, reason, error: err},
			runResult: undefined,
			elapsed: mainStopwatch(),
		};
	}

	// Run the loaded tasks in series.
	let runResult: TaskRunResult;
	const taskStopwatch = createStopwatch();
	info(`→ ${cyan(task.name)}`);
	try {
		const result = await task.mod.task.run({
			args,
			log: new SystemLogger(
				log.prefixes.concat(cyan(`[${task.name}]`)),
				log.suffixes,
				log.state,
			),
		});
		const elapsed = taskStopwatch();
		runResult = {ok: true, taskName: task.name, elapsed, result};
		info(`✓ ${cyan(task.name)} 🕒 ${fmtMs(elapsed)}`);
	} catch (err) {
		const reason = `Unexpected error running task ${cyan(
			task.name,
		)}. Aborting.`;
		info(red(reason));
		info(fmtError(err));
		return {
			ok: false,
			taskName,
			loadResult,
			runResult: {ok: false, taskName: task.name, reason, error: err},
			elapsed: mainStopwatch(),
		};
	}

	const elapsed = mainStopwatch();
	info(`🕒 ${fmtMs(elapsed)}`);

	return {ok: true, taskName, loadResult, runResult, elapsed};
};
