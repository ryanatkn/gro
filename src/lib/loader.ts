/*

usage: node --loader @feltjs/gro/loader.js foo.ts

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

export const load = async (
	url: string,
	context: LoadContext,
	nextLoad: NextLoad,
): Promise<LoadReturn> => {
	// TODO BLOCK how to shim $env?
	console.log(`load ` + url);
	console.log(`context`, context);
	if (url.includes('shim_'))
		return {
			format: 'module',
			shortCircuit: true,
			source: 'console.log("SHIM");',
		};
	if (matcher.test(url)) {
		const path = fileURLToPath(url);
		const dir = dirname(path) + '/';
		const loaded = await nextLoad(url, {...context, format: 'module'});
		const transformed = transformSync(loaded.source.toString(), transformOptions); // eslint-disable-line @typescript-eslint/no-base-to-string
		// TODO change this to an esbuild plugin, assuming it can be
		const processed = postprocess(transformed.code, dir, dir, '.ts');
		return {
			format: 'module',
			shortCircuit: true,
			source: processed.content,
		};
	}

	return nextLoad(url);
};

export const resolve = (
	specifier: string,
	context: ResolveContext,
	nextResolve: NextResolve,
): ResolveReturn => {
	console.log(`specifier`, specifier, context);
	if (specifier.endsWith('static_public.js')) {
		return nextResolve('../../.gro/dev/system/lib/sveltekit_shim_env_static_public.js');
	}

	return nextResolve(specifier);
};

interface ResolveContext {
	conditions: string[];
	importAssertions: object;
	parentURL: string;
}
interface NextResolve {
	(specifier: string, context?: ResolveContext): ResolveReturn;
}
interface ResolveReturn {
	format?: ModuleFormat | null;
	importAssertions?: object;
	shortCircuit?: boolean;
	url: string;
}

interface LoadContext {
	conditions: string[];
	format?: ModuleFormat;
	importAssertions: object;
}
interface NextLoad {
	(specifier: string, context?: LoadContext): Promise<LoadReturn>;
}
interface LoadReturn {
	format: ModuleFormat;
	shortCircuit?: boolean;
	source: string | ArrayBuffer | TypedArray;
}

type ModuleFormat = 'builtin' | 'commonjs' | 'json' | 'module' | 'wasm';
type TypedArray =
	| Int8Array
	| Uint8Array
	| Uint8ClampedArray
	| Int16Array
	| Uint16Array
	| Int32Array
	| Uint32Array
	| Float32Array
	| Float64Array
	| BigInt64Array
	| BigUint64Array;
