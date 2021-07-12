import * as terser from 'terser';
import type {Plugin as Rollup_Plugin} from 'rollup';
import {createFilter} from '@rollup/pluginutils';
import {print_log_label, System_Logger} from '@feltcoop/felt/util/log.js';
import type {Logger} from '@feltcoop/felt/util/log.js';
import {print_error} from '@feltcoop/felt/util/print.js';

import {print_path} from '../paths.js';

// TODO speed up with workers

export interface Options {
	include?: string | RegExp | (string | RegExp)[] | null;
	exclude?: string | RegExp | (string | RegExp)[] | null;
	minify_options?: terser.MinifyOptions;
	log?: Logger;
}

export const name = '@feltcoop/rollup_plugin_gro_terser';

export const rollup_plugin_gro_terser = (options: Options = {}): Rollup_Plugin => {
	const {
		include = null,
		exclude = null,
		minify_options = {sourceMap: false},
		log = new System_Logger(print_log_label(name)),
	} = options;

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
