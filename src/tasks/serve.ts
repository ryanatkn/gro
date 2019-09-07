import {resolve} from 'path';
import {blue, magenta} from 'kleur';

import {logger, LogLevel} from '../utils/logUtils';
import {createDevServer} from '../devServer/devServer';
import {omitUndefined} from '../utils/objectUtils';

// TODO LogLevel from env vars and cli args
const log = logger(LogLevel.Trace, [blue(`[tasks/${magenta('serve')}]`)]);
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
		...omitUndefined(opts),
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
