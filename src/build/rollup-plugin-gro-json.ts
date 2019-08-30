import {Plugin} from 'rollup';
import {createFilter, dataToEsm} from 'rollup-pluginutils';
import {magenta, gray} from 'kleur';

import {logger, LogLevel} from '../utils/logger';
import {toRootPath} from '../paths';

// TODO support parsing from a string (faster than parsing JS)
// TODO support lazy-loading

export interface Options {
	include: string | RegExp | (string | RegExp)[] | null | undefined;
	exclude: string | RegExp | (string | RegExp)[] | null | undefined;
	compact: boolean;
	indent: string;
	namedExports: boolean;
	preferConst: boolean;
	logLevel: LogLevel;
}
export type RequiredOptions = never;
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (initialOptions: InitialOptions): Options => ({
	include: '**/*.json',
	exclude: null,
	compact: false,
	indent: '\t',
	namedExports: true,
	preferConst: true,
	logLevel: LogLevel.Info,
	...initialOptions,
});

export const name = 'gro-json';

export const groJsonPlugin = (opts: InitialOptions = {}): Plugin => {
	const {
		include,
		exclude,
		compact,
		indent,
		namedExports,
		preferConst,
		logLevel,
	} = initOptions(opts);

	const log = logger(logLevel, [magenta(`[${name}]`)]);
	const {trace} = log;

	const filter = createFilter(include, exclude);

	return {
		name,
		async transform(code, id) {
			if (!filter(id)) return null;

			trace('transform json', gray(toRootPath(id)));

			return {
				code: dataToEsm(JSON.parse(code), {
					compact,
					indent,
					namedExports,
					preferConst,
				}),
				map: {mappings: ''} as const,
			};
		},
	};
};
