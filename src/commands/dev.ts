import {blue, magenta} from '../colors/terminal.js';
import {logger, LogLevel} from '../utils/log.js';
import * as buildTask from './build.js';
import * as serveTask from './serve.js';
import {omitUndefined} from '../utils/object.js';

// TODO LogLevel from env vars and cli args
const log = logger(LogLevel.Trace, [blue(`[commands/${magenta('dev')}]`)]);
const {info} = log;

export type Options = buildTask.Options & serveTask.Options;
export type RequiredOptions =
	| buildTask.RequiredOptions
	| serveTask.RequiredOptions;
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
const DEFAULT_SERVE_DIR = 'dist/';
export const initOptions = (opts: InitialOptions): Options => {
	// TODO types are a mess
	const options = {
		watch: true,
		dir: DEFAULT_SERVE_DIR,
		...omitUndefined(opts),
	};
	return buildTask.initOptions(
		serveTask.initOptions(options) as Options,
	) as Options;
};

export const run = async (opts: InitialOptions): Promise<void> => {
	const options = initOptions(opts);
	info('options', options);

	await Promise.all([buildTask.run(options), serveTask.run(options)]);

	// ...
};
