import fs from 'fs-extra';

import {paths} from '../paths.js';
import {LogLevel, logger} from '../utils/log.js';
import {magenta} from '../colors/terminal.js';
import {omitUndefined} from '../utils/object.js';
import {fmtPath} from '../utils/fmt.js';

export interface Options {
	logLevel: LogLevel;
}
export type RequiredOptions = never;
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => ({
	logLevel: LogLevel.Info,
	...omitUndefined(opts),
});

export const clean = async (opts: InitialOptions = {}) => {
	const options = initOptions(opts);
	const {logLevel} = options;
	const log = logger(logLevel, [magenta('[clean]')]);
	const {info} = log;

	if (fs.existsSync(paths.build)) {
		info('emptying', fmtPath(paths.build));
		await fs.emptyDir(paths.build);
	}
	if (fs.existsSync(paths.dist)) {
		info('emptying', fmtPath(paths.dist));
		await fs.emptyDir(paths.dist);
	}
};
