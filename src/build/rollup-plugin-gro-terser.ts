import {minify, MinifyOptions} from 'terser';
import {Plugin} from 'rollup';
import {createFilter} from 'rollup-pluginutils';
import {magenta, gray} from 'kleur';

import {logger, LogLevel} from '../utils/logUtils';
import {toRootPath} from '../paths';

// TODO speed up with workers
// TODO this runs twice with build but not watch
// can it be moved from `renderChunk` to `generateBundle`
// without any negative consequences to avoid doing double the work?

export interface Options {
	include: string | RegExp | (string | RegExp)[] | null | undefined;
	exclude: string | RegExp | (string | RegExp)[] | null | undefined;
	minifyOptions: MinifyOptions;
	logLevel: LogLevel;
}
export type RequiredOptions = never;
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (initialOptions: InitialOptions): Options => ({
	include: null,
	exclude: null,
	minifyOptions: {sourceMap: false},
	logLevel: LogLevel.Info,
	...initialOptions,
});

export const name = 'gro-terser';

export const groTerserPlugin = (opts: InitialOptions = {}): Plugin => {
	const {include, exclude, minifyOptions, logLevel} = initOptions(opts);

	const log = logger(logLevel, [magenta(`[${name}]`)]);
	const {info, error} = log;

	const filter = createFilter(include, exclude);

	return {
		name,
		renderChunk(code, chunk, outputOptions) {
			if (!filter(chunk.fileName)) return null;

			info('terser', gray(toRootPath(chunk.fileName)));

			const minified = minify(code, {
				module: ['es', 'esm'].includes(outputOptions.format!),
				...minifyOptions,
			});

			if (minified.error) {
				error(minified.error); // TODO format
				throw minified.error;
			}

			if (minified.code === undefined) {
				throw Error('Minified code result is undefined');
			}

			return {
				...minified,
				code: minified.code, // this is weird, but without it `renderChunk` doesn't like the return value type, even with a `minified.code === undefined` check
			};
		},
	};
};
