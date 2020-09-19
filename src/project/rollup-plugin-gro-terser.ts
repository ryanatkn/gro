import * as terser from 'terser';
import {Plugin} from 'rollup';
import {createFilter} from '@rollup/pluginutils';

import {magenta} from '../colors/terminal.js';
import {SystemLogger} from '../utils/log.js';
import {printPath, printError} from '../utils/print.js';
import {omitUndefined} from '../utils/object.js';

// TODO speed up with workers

export interface Options {
	include: string | RegExp | (string | RegExp)[] | null;
	exclude: string | RegExp | (string | RegExp)[] | null;
	minifyOptions: terser.MinifyOptions;
}
export type InitialOptions = Partial<Options>;
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
		async renderChunk(code, chunk, outputOptions) {
			if (!filter(chunk.fileName)) return null;

			log.info('terser', printPath(chunk.fileName));

			try {
				const minifiedResult = await terser.minify(code, {
					module: ['es', 'esm'].includes(outputOptions.format!),
					...minifyOptions,
				});

				return minifiedResult as any; // TODO type?
			} catch (err) {
				log.error(printError(err)); // TODO code frame?
				throw err;
			}
		},
	};
};
