import type {Plugin} from 'rollup';
import {createFilter, dataToEsm} from '@rollup/pluginutils';

import {printLogLabel, SystemLogger} from '../utils/log.js';
import {printPath} from '../utils/print.js';
import {omitUndefined} from '../utils/object.js';

// TODO support parsing from a string (faster than parsing JS)
// TODO support lazy-loading

export interface Options {
	include: string | RegExp | (string | RegExp)[] | null;
	exclude: string | RegExp | (string | RegExp)[] | null;
	compact: boolean;
	indent: string;
	namedExports: boolean;
	preferConst: boolean;
}
export type InitialOptions = Partial<Options>;
export const initOptions = (opts: InitialOptions): Options => ({
	include: '**/*.json',
	exclude: null,
	compact: false,
	indent: '\t',
	namedExports: true,
	preferConst: true,
	...omitUndefined(opts),
});

export const name = 'gro-json';

export const groJsonPlugin = (opts: InitialOptions = {}): Plugin => {
	const {include, exclude, compact, indent, namedExports, preferConst} = initOptions(opts);

	const log = new SystemLogger(printLogLabel(name));

	const filter = createFilter(include, exclude);

	return {
		name,
		async transform(code, id) {
			if (!filter(id)) return null;

			log.trace('transform json', printPath(id));

			return {
				code: dataToEsm(JSON.parse(code), {
					compact,
					indent,
					namedExports,
					preferConst,
				}),
				map: {mappings: ''} as const,
			};
		},
	};
};
