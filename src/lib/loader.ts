/*

usage: node --loader @grogarden/gro/loader.js foo.ts

usage in Gro: node --loader ./dist/loader.js foo.ts

*/

import {transformSync, type TransformOptions} from 'esbuild';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {cwd} from 'node:process';

import {postprocess} from './build/postprocess.js';

console.log(`cwd()`, cwd());
console.log(`pathToFileURL(cwd() + '/').href`, pathToFileURL(cwd() + '/').href);
console.log(`import.meta.url`, import.meta.url);
console.log(`fileURLToPath(import.meta.url)`, fileURLToPath(import.meta.url));

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
