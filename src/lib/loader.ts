/*

usage: node --loader @feltjs/gro/loader.js foo.ts

usage in Gro: node --loader ./dist/loader.js foo.ts

*/

import {transformSync, type TransformOptions} from 'esbuild';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {dirname, join} from 'node:path';
import {existsSync} from 'node:fs'; // eslint-disable-line @typescript-eslint/no-restricted-imports

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
	// TODO BLOCK how to shim $env? does the specifier need to be modified in `resolve`, or just shortCircuited?
	console.log(`load ` + url);
	if (matcher.test(url)) {
		// const path = fileURLToPath(url);
		// const dir = dirname(path) + '/';
		const loaded = await nextLoad(url, {...context, format: 'module'});
		// TODO BLOCK maybe do path mapping in a plugin here instead of the resolve hook?
		const transformed = transformSync(loaded.source.toString(), transformOptions); // eslint-disable-line @typescript-eslint/no-base-to-string
		return {format: 'module', shortCircuit: true, source: transformed.code};
	}

	console.log('LOAD DEFAULT', url);
	return nextLoad(url, context);
};

export const resolve = async (
	specifier: string,
	context: ResolveContext,
	nextResolve: NextResolve,
): Promise<ResolveReturn> => {
	// handle $lib imports relative to the parent
	const parent_path = context.parentURL && fileURLToPath(context.parentURL);
	console.log(`specifier, parent_path`, specifier, parent_path);
	if (context.parentURL !== undefined) {
		console.log(`specifier`, specifier, parent_path);
		if (specifier.startsWith('$lib/')) {
			console.log(`LIB`);
		}
	}

	if (specifier[0] === '.' && specifier.endsWith('.js')) {
		const js_url = parent_path ? join(parent_path, '../', specifier) : specifier;
		// TODO this was supposedly unflagged for Node 20.6 but it's still undefined for me
		// await import.meta.resolve(specifier);
		if (existsSync(js_url)) {
			return {url: pathToFileURL(js_url).href, format: 'module', shortCircuit: true};
		}
		const ts_url = js_url.slice(0, -3) + '.ts';
		if (existsSync(ts_url)) {
			return {url: pathToFileURL(ts_url).href, format: 'module', shortCircuit: true};
		}
	}

	return nextResolve(specifier, context);
};

interface ResolveContext {
	/**
	 * Is `undefined` for the entry module.
	 */
	parentURL?: string;
	conditions: string[];
	importAssertions: object;
}
interface NextResolve {
	(specifier: string, context: ResolveContext): ResolveReturn | Promise<ResolveReturn>;
}
interface ResolveReturn {
	url: string;
	format?: ModuleFormat | null;
	importAssertions?: object;
	shortCircuit?: boolean;
}

interface LoadContext {
	format?: ModuleFormat;
	conditions: string[];
	importAssertions: object;
}
interface NextLoad {
	(specifier: string, context: LoadContext): Promise<LoadReturn>;
}
interface LoadReturn {
	source: string | ArrayBuffer | TypedArray;
	format: ModuleFormat;
	shortCircuit?: boolean;
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
