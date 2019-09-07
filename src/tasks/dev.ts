import {blue, magenta} from 'kleur';

import {logger, LogLevel} from '../utils/logUtils';
import * as buildAction from './build';
import * as serveAction from './serve';
import {omitUndefined} from '../utils/objectUtils';

// TODO LogLevel from env vars and cli args
const log = logger(LogLevel.Trace, [blue(`[tasks/${magenta('dev')}]`)]);
const {info} = log;

export type Options = buildAction.Options & serveAction.Options;
export type RequiredOptions =
	| buildAction.RequiredOptions
	| serveAction.RequiredOptions;
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => {
	// TODO types are a mess
	const options = {
		watch: true,
		...omitUndefined(opts),
	};
	return buildAction.initOptions(serveAction.initOptions(
		options,
	) as Options) as Options;
};

export const run = async (opts: InitialOptions): Promise<void> => {
	const options = initOptions(opts);
	info('options', options);

	await Promise.all([buildAction.run(options), serveAction.run(options)]);

	// ...
};
