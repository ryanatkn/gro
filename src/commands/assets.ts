import {blue, magenta} from '../colors/terminal.js';
import {assets} from '../project/assets.js';
import {SystemLogger} from '../utils/log.js';

const {info} = new SystemLogger([blue(`[commands/${magenta('assets')}]`)]);

export interface Options {}
export type RequiredOptions = never;
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => opts;

export const run = async (opts: InitialOptions): Promise<void> => {
	const options = initOptions(opts);
	info('options', options);

	await assets();
};
