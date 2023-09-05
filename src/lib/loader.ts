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
	console.log(`context`, context);
	if (matcher.test(url)) {
		const path = fileURLToPath(url);
		const dir = dirname(path) + '/';
		const loaded = await nextLoad(url, {...context, format: 'module'});
		const transformed = transformSync(loaded.source.toString(), transformOptions); // eslint-disable-line @typescript-eslint/no-base-to-string
		// TODO change this to an esbuild plugin, assuming it can be
		const processed = postprocess(transformed.code, dir, dir, '.ts');
		return {format: 'module', shortCircuit: true, source: processed.content};
	}

	return nextLoad(url);
};

export const resolve = (
	specifier: string,
	context: ResolveContext,
	nextResolve: NextResolve,
): ResolveReturn | Promise<ResolveReturn> => {
	console.log(`specifier`, specifier, context.parentURL);
	if (specifier.endsWith('static_public.js')) {
		const url = pathToFileURL(
			join(
				fileURLToPath(context.parentURL),
				'../../../.gro/dev/system/lib/sveltekit_shim_env_static_public.js',
			),
		).href;
		console.log(`url`, url);
		return {url, format: 'module', shortCircuit: true};
	}
	if (specifier[0] === '.' && specifier.endsWith('.js')) {
		const js_url = join(fileURLToPath(context.parentURL), '../', specifier);
		if (existsSync(js_url)) {
			return {url: pathToFileURL(js_url).href, format: 'module', shortCircuit: true};
		}
		const ts_url = js_url.slice(0, -3) + '.ts';
		if (existsSync(ts_url)) {
			return {url: pathToFileURL(ts_url).href, format: 'module', shortCircuit: true};
		}
	}

	return nextResolve(specifier);
};

interface ResolveContext {
	parentURL: string;
	conditions: string[];
	importAssertions: object;
}
interface NextResolve {
	(specifier: string, context?: ResolveContext): ResolveReturn | Promise<ResolveReturn>;
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
	(specifier: string, context?: LoadContext): Promise<LoadReturn>;
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
