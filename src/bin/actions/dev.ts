import {blue, magenta} from 'kleur';

import {logger, LogLevel} from '../../project/logger';
import * as buildAction from './build';
import * as serveAction from './serve';

// TODO LogLevel from env vars and cli args
const log = logger(LogLevel.Trace, [blue(`[bin/actions/${magenta('dev')}]`)]);
const {info} = log;

export type DevActionOptions = buildAction.BuildActionOptions &
	serveAction.ServeActionOptions;
export type RequiredDevActionOptions =
	| buildAction.RequiredBuildActionOptions
	| serveAction.RequiredServeActionOptions;
export type InitialDevActionOptions = PartialExcept<
	DevActionOptions,
	RequiredDevActionOptions
>;
export const defaultDevActionOptions = (
	opts: InitialDevActionOptions,
): DevActionOptions => {
	// TODO types are a mess
	const options = {
		...opts,
		watch: opts.watch === undefined ? true : opts.watch,
	};
	return buildAction.defaultBuildActionOptions(
		serveAction.defaultServeActionOptions(options) as DevActionOptions,
	) as DevActionOptions;
};

export const run = async (opts: InitialDevActionOptions): Promise<void> => {
	const options = defaultDevActionOptions(opts);
	info('options', options);

	await Promise.all([buildAction.run(options), serveAction.run(options)]);

	// ...
};
