import {blue, magenta} from '../colors/terminal.js';
import {assets} from '../project/assets.js';
import {logger, LogLevel} from '../utils/log.js';

// TODO get LogLevel from env vars and cli args - make it an option
const logLevel = LogLevel.Trace;

const log = logger(logLevel, [blue(`[tasks/${magenta('assets')}]`)]);
const {info} = log;

export interface Options {}
export type RequiredOptions = never;
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => opts;

export const run = async (opts: InitialOptions): Promise<void> => {
	const options = initOptions(opts);
	info('options', options);

	await assets({logLevel});
};
