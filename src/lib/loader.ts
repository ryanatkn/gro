/*

usage: node --loader @grogarden/gro/loader.js foo.ts

usage in Gro: node --loader ./dist/loader.js foo.ts

*/

import {transformSync, type TransformOptions} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {dirname} from 'path';

import {postprocess} from './build/postprocess.js';

const transformOptions: TransformOptions = {
	target: 'esnext',
	sourcemap: false, // TODO add support - runtime lookup to `source-map-support`?
	format: 'esm',
	loader: 'ts',
	charset: 'utf8',
	// TODO load local tsconfig
	tsconfigRaw: {
		compilerOptions: {
			importsNotUsedAsValues: 'error',
			preserveValueImports: true,
		},
	},
};

const matcher = /\.(ts|tsx|mts|cts)$/u;

export const load = async (url: string, context: any, nextLoad: any): Promise<any> => {
	if (matcher.test(url)) {
		const path = fileURLToPath(url);
		const dir = dirname(path) + '/';
		const loaded = await nextLoad(url, {...context, format: 'module'});
		const transformed = transformSync(loaded.source.toString(), transformOptions);
		// TODO change this to an esbuild plugin, assuming it can be
		const processed = postprocess(transformed.code, dir, dir);
		return {
			format: 'module',
			shortCircuit: true,
			source: processed.content,
		};
	}

	return nextLoad(url);
};
