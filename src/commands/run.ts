import {blue, magenta} from '../colors/terminal.js';
import {run as runTasks} from '../run/run.js';
import {logger, LogLevel} from '../utils/log.js';

// TODO get LogLevel from env vars and cli args - make it an option
const logLevel = LogLevel.Trace;

const log = logger(logLevel, [blue(`[commands/${magenta('run')}]`)]);
const {info} = log;

export interface Options {
	_: string[]; // optional array of task names
}
export type RequiredOptions = '_';
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => opts;

export const run = async (opts: InitialOptions): Promise<void> => {
	const options = initOptions(opts);
	info('options', options);
	const {_: taskNames} = options;

	await runTasks({logLevel, taskNames});
};
