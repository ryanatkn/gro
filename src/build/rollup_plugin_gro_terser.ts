import * as terser from 'terser';
import type {Plugin as Rollup_Plugin} from 'rollup';
import {createFilter} from '@rollup/pluginutils';
import {print_log_label, System_Logger} from '@feltcoop/felt/util/log.js';
import {print_error} from '@feltcoop/felt/util/print.js';
import {omit_undefined} from '@feltcoop/felt/util/object.js';

import {print_path} from '../paths.js';

// TODO speed up with workers

export interface Options {
	include: string | RegExp | (string | RegExp)[] | null;
	exclude: string | RegExp | (string | RegExp)[] | null;
	minify_options: terser.MinifyOptions;
}
export type Initial_Options = Partial<Options>;
export const init_options = (opts: Initial_Options): Options => ({
	include: null,
	exclude: null,
	minify_options: {sourceMap: false},
	...omit_undefined(opts),
});

export const name = '@feltcoop/rollup_plugin_gro_terser';

export const rollup_plugin_gro_terser = (opts: Initial_Options = {}): Rollup_Plugin => {
	const {include, exclude, minify_options} = init_options(opts);

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
					...minify_options,
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
