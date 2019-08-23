import {resolve} from 'path';
import {blue, magenta} from 'kleur';

import {logger, LogLevel} from '../../utils/logger';
import {createDevServer} from '../../devServer/devServer';

// TODO LogLevel from env vars and cli args
const log = logger(LogLevel.Trace, [blue(`[bin/actions/${magenta('serve')}]`)]);
const {info} = log;

export interface Options {
	dir: string;
	host: string;
	port: number;
}
export type RequiredOptions = never;
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
const DEFAULT_HOST = '0.0.0.0'; // 'localhost'; why is 0.0.0.0 needed here but not for sirv?
const DEFAULT_PORT = 8999;
export const initOptions = (opts: InitialOptions): Options => {
	const dir = resolve(opts.dir || '.');
	return {
		host: DEFAULT_HOST,
		port: DEFAULT_PORT,
		...opts,
		dir,
	};
};

export const run = async (opts: InitialOptions): Promise<void> => {
	const options = initOptions(opts);
	info('options', options);
	const {host, port, dir} = options;

	const devServer = createDevServer({host, port, dir});
	info(`serving ${dir} on ${host}:${port}`);
	await devServer.start();

	// ...
};
