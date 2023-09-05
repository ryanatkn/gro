/*

usage: node --loader @grogarden/gro/loader.js foo.ts

usage in Gro: node --loader ./dist/loader.js foo.ts

*/

import {transformSync, type TransformOptions} from 'esbuild';
import * as lexer from 'es-module-lexer';

import {postprocess} from './build/postprocess.js';

await lexer.init;

const transformOptions: TransformOptions = {
	target: 'esnext',
	sourcemap: false, // TODO add support
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

// TODO BLOCK
const build_dir = '';
const source_dir = '';

export const load = async (url: string, context: any, nextLoad: any): Promise<any> => {
	if (matcher.test(url)) {
		const loaded = await nextLoad(url, {...context, format: 'module'});
		const transformed = transformSync(loaded.source.toString(), transformOptions);
		const processed = postprocess(transformed.code, build_dir, source_dir);
		return {
			format: 'module',
			shortCircuit: true,
			source: processed.content,
		};
	}

	return nextLoad(url);
};
