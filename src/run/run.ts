import {join} from 'path';

import {LogLevel, logger} from '../utils/log.js';
import {cyan, magenta, red, yellow} from '../colors/terminal.js';
import {omitUndefined} from '../utils/object.js';
import {
	TaskModuleMeta,
	toTaskPath,
	TaskContext,
	TaskData,
	toTaskName,
} from './task.js';
import {fmtMs, fmtError} from '../utils/fmt.js';
import {createStopwatch} from '../utils/time.js';
import {Argv} from '../bin/types.js';
import {toBasePath, isSourceId} from '../paths.js';

export interface Options {
	logLevel: LogLevel;
	host: RunHost;
	dir: string;
	taskNames: string[];
	argv: Argv;
}
export type RequiredOptions = 'host' | 'dir' | 'taskNames' | 'argv';
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => ({
	logLevel: LogLevel.Info,
	...omitUndefined(opts),
});

export interface RunHost {
	findTaskModules: (dir: string) => Promise<string[]>; // returns source ids
	loadTaskModule: (sourceId: string) => Promise<TaskModuleMeta>;
}

export type RunResult = {
	ok: boolean;
	data: TaskData;
	taskNames: string[];
	loadResults: TaskLoadResult[];
	runResults: TaskRunResult[];
	elapsed: number;
};
export type TaskLoadResult =
	| {ok: true; taskName: string}
	| {
			ok: false;
			taskName: string;
			reason: string;
			error: Error;
	  };
export type TaskRunResult =
	| {ok: true; taskName: string; elapsed: number}
	| {
			ok: false;
			taskName: string;
			reason: string;
			error: Error;
	  };

export const run = async (
	opts: InitialOptions,
	initialData: TaskData = {},
): Promise<RunResult> => {
	const options = initOptions(opts);
	const {logLevel, host, dir, taskNames, argv} = options;
	const log = logger(logLevel, [magenta('[run]')]);
	const {error, info} = log;

	// TODO is this right? or should we convert input paths to source ids?
	if (!isSourceId(dir)) {
		throw Error(`dir must be a source id: ${dir}`);
	}

	const ctx: TaskContext = {log, argv};

	// `data` is a shared object that's sent through each task.
	// It can be mutated or treated as immutable. Be careful with mutation!
	let data = initialData;

	const mainStopwatch = createStopwatch();

	// If no task names are provided,
	// find all of the available ones and print them out.
	if (!taskNames.length) {
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
			data,
			taskNames,
			loadResults: [],
			runResults: [],
			elapsed: mainStopwatch(),
		};
	}

	// First load all of the specified tasks,
	// so any errors cause the command to exit before running anything.
	// We don't want to run only some tasks in a series!
	const loadedTasks = await Promise.all(
		taskNames.map(
			async (taskName): Promise<[TaskModuleMeta | null, TaskLoadResult]> => {
				const path = toTaskPath(taskName);
				const sourceId = join(dir, path);
				try {
					const task = await host.loadTaskModule(sourceId);
					return [task, {ok: true, taskName}];
				} catch (err) {
					const reason = `Failed to load task "${taskName}".`;
					error(red(reason), yellow(err.message));
					return [null, {ok: false, taskName, reason, error: err}];
				}
			},
		),
	);
	const loadResults = loadedTasks.map(([_, r]) => r);

	// Abort if the cancellation flag was set.
	// Postponing this check allows all errors to surface.
	const failedToLoadAnyTasks = loadedTasks.find(([t]) => !t);
	if (failedToLoadAnyTasks) {
		info(yellow('Aborting. No tasks were run due to errors.'));
		return {
			ok: false,
			data,
			taskNames,
			loadResults,
			runResults: [],
			elapsed: mainStopwatch(),
		};
	}

	// Run the loaded tasks in series.
	const tasks = loadedTasks.map(([t]) => t!);
	const runResults: TaskRunResult[] = [];
	for (const task of tasks) {
		const taskStopwatch = createStopwatch();
		info(`→ ${cyan(task.name)}`);
		try {
			const nextData = await task.mod.task.run(ctx, data);
			if (nextData) {
				data = nextData;
			}
			const elapsed = taskStopwatch();
			runResults.push({ok: true, taskName: task.name, elapsed});
			info(`✓ ${cyan(task.name)} 🕒 ${fmtMs(elapsed)}`);
		} catch (err) {
			const reason = `Unexpected error running task ${cyan(
				task.name,
			)}. Aborting.`;
			info(red(reason));
			info(fmtError(err));
			runResults.push({ok: false, taskName: task.name, reason, error: err});
			return {
				ok: false,
				data,
				taskNames,
				loadResults,
				runResults,
				elapsed: mainStopwatch(),
			};
		}
	}

	const elapsed = mainStopwatch();
	info(`🕒 ${fmtMs(elapsed)}`);

	return {ok: true, data, taskNames, loadResults, runResults, elapsed};
};
