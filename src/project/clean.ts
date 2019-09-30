import fs from 'fs-extra';

import {paths, toRootPath} from '../paths.js';
import {LogLevel, logger} from '../utils/log.js';
import {magenta, gray} from '../colors/terminal.js';
import {omitUndefined} from '../utils/object.js';

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
		info('emptying', gray(toRootPath(paths.build)));
		await fs.emptyDir(paths.build);
	}
	if (fs.existsSync(paths.dist)) {
		info('emptying', gray(toRootPath(paths.dist)));
		await fs.emptyDir(paths.dist);
	}
};
