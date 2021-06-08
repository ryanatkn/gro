import * as terser from 'terser';
import type {Plugin} from 'rollup';
import {createFilter} from '@rollup/pluginutils';
import {print_log_label, System_Logger} from '@feltcoop/felt/utils/log.js';
import {print_error} from '@feltcoop/felt/utils/print.js';
import {omitUndefined} from '@feltcoop/felt/utils/object.js';

import {print_path} from '../paths.js';

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

	const log = new System_Logger(print_log_label(name));

	const filter = createFilter(include, exclude);

	return {
		name,
		async renderChunk(code, chunk, {format}) {
			if (!filter(chunk.fileName)) return null;

			log.info('terser', print_path(chunk.fileName));

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
				log.error(print_error(err)); // TODO code frame?
				throw err;
			}
		},
	};
};
