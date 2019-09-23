import * as terser from 'terser';
import {Plugin} from 'rollup';
import rollupPluginutils from 'rollup-pluginutils';
const {createFilter} = rollupPluginutils; // TODO esm

import {magenta, gray} from '../colors/terminal.js';
import {logger, LogLevel} from '../utils/logUtils.js';
import {toRootPath} from '../paths.js';
import {omitUndefined} from '../utils/objectUtils.js';

// TODO speed up with workers
// TODO this runs twice with build but not watch
// can it be moved from `renderChunk` to `generateBundle`
// without any negative consequences to avoid doing double the work?

export interface Options {
	include: string | RegExp | (string | RegExp)[] | null;
	exclude: string | RegExp | (string | RegExp)[] | null;
	minifyOptions: terser.MinifyOptions;
	logLevel: LogLevel;
}
export type RequiredOptions = never;
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => ({
	include: null,
	exclude: null,
	minifyOptions: {sourceMap: false},
	logLevel: LogLevel.Info,
	...omitUndefined(opts),
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

			const minified = terser.minify(code, {
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
