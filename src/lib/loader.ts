/*

usage: node --loader @grogarden/gro/loader.js foo.ts

usage in Gro: node --loader ./dist/loader.js foo.ts

*/

import {transformSync, type TransformOptions} from 'esbuild';
import * as lexer from 'es-module-lexer';

await lexer.init;

const transformOptions: TransformOptions = {
	target: 'esnext',
	sourcemap: false,
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
		const loaded = await nextLoad(url, {...context, format: 'module'});
		const transformed = transformSync(loaded.source.toString(), transformOptions);
		return {
			format: 'module',
			shortCircuit: true,
			source: transformed.code,
		};
	}

	return nextLoad(url);
};
