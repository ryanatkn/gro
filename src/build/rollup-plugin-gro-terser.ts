import * as terser from 'terser';
import type {Plugin} from 'rollup';
import {createFilter} from '@rollup/pluginutils';
import {printLogLabel, SystemLogger} from '@feltcoop/felt/utils/log.js';
import {printError} from '@feltcoop/felt/utils/print.js';
import {omitUndefined} from '@feltcoop/felt/utils/object.js';

import {printPath} from '../paths.js';

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

	const log = new SystemLogger(printLogLabel(name));

	const filter = createFilter(include, exclude);

	return {
		name,
		async renderChunk(code, chunk, {format}) {
			if (!filter(chunk.fileName)) return null;

			log.info('terser', printPath(chunk.fileName));

			try {
				const result = await terser.minify(code, {
					module: format === 'es',
					...minifyOptions,
				});

				if (result.code === undefined) {
					throw Error(`terser returned undefined for ${chunk.fileName}`);
				}

				log.trace('minified size', code.length, '→', result.code.length);
				return result as any;
			} catch (err) {
				log.error(printError(err)); // TODO code frame?
				throw err;
			}
		},
	};
};
