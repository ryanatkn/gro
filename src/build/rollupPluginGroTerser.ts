import * as terser from 'terser';
import type {Plugin as RollupPlugin} from 'rollup';
import {createFilter} from '@rollup/pluginutils';
import {printLogLabel, SystemLogger} from '@feltcoop/felt/util/log.js';
import type {Logger} from '@feltcoop/felt/util/log.js';
import {printError} from '@feltcoop/felt/util/print.js';

import {printPath} from '../paths.js';

// TODO speed up with workers

export interface Options {
	include?: string | RegExp | (string | RegExp)[] | null;
	exclude?: string | RegExp | (string | RegExp)[] | null;
	minifyOptions?: terser.MinifyOptions;
	log?: Logger;
}

export const name = '@feltcoop/rollupPluginGroTerser';

export const rollupPluginGroTerser = (options: Options = {}): RollupPlugin => {
	const {
		include = null,
		exclude = null,
		minifyOptions = {sourceMap: false},
		log = new SystemLogger(printLogLabel(name)),
	} = options;

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
