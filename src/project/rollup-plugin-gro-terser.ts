import terser from 'terser';
import {Plugin} from 'rollup';
import rollupPluginutils from '@rollup/pluginutils';
const {createFilter} = rollupPluginutils; // TODO esm

import {magenta} from '../colors/terminal.js';
import {SystemLogger} from '../utils/log.js';
import {printPath} from '../utils/print.js';
import {omitUndefined} from '../utils/object.js';

// TODO speed up with workers
// TODO this runs twice with build but not watch
// can it be moved from `renderChunk` to `generateBundle`
// without any negative consequences to avoid doing double the work?

export interface Options {
	include: string | RegExp | (string | RegExp)[] | null;
	exclude: string | RegExp | (string | RegExp)[] | null;
	minifyOptions: terser.MinifyOptions;
}
export type RequiredOptions = never;
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => ({
	include: null,
	exclude: null,
	minifyOptions: {sourceMap: false},
	...omitUndefined(opts),
});

export const name = 'gro-terser';

export const groTerserPlugin = (opts: InitialOptions = {}): Plugin => {
	const {include, exclude, minifyOptions} = initOptions(opts);

	const log = new SystemLogger([magenta(`[${name}]`)]);

	const filter = createFilter(include, exclude);

	return {
		name,
		renderChunk(code, chunk, outputOptions) {
			if (!filter(chunk.fileName)) return null;

			log.info('terser', printPath(chunk.fileName));

			const minified = terser.minify(code, {
				module: ['es', 'esm'].includes(outputOptions.format!),
				...minifyOptions,
			});

			if (minified.error) {
				log.error(minified.error); // TODO format
				throw minified.error;
			}

			if (minified.code === undefined) {
				throw Error('Minified code result is undefined');
			}

			return {
				...(minified as any), // TODO cast to any because of type mismatch caused by terser using source-map@0.6 - https://github.com/terser/terser/issues/385
				code: minified.code, // this is weird, but without it `renderChunk` doesn't like the return value type, even with a `minified.code === undefined` check
			};
		},
	};
};
