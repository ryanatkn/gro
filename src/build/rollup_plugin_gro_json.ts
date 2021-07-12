import type {Plugin} from 'rollup';
import {createFilter} from '@rollup/pluginutils';
import {print_log_label, System_Logger} from '@feltcoop/felt/util/log.js';

import {print_path} from '../paths.js';

// TODO support parsing from a string (faster than parsing JS)

export interface Options {
	include?: string | RegExp | (string | RegExp)[] | null;
	exclude?: string | RegExp | (string | RegExp)[] | null;
}

export const name = 'gro-json';

export const groJsonPlugin = (opts: Options): Plugin => {
	const {include = '**/*.json', exclude = null} = opts;

	const log = new System_Logger(print_log_label(name));

	const filter = createFilter(include, exclude);

	return {
		name,
		async transform(code, id) {
			if (!filter(id)) return null;

			log.trace('transform json', print_path(id));

			return {
				code: `export default ${code}`,
				map: {mappings: ''} as const,
			};
		},
	};
};
