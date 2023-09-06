/*

usage: node --loader @feltjs/gro/loader.js foo.ts

usage in Gro: node --loader ./dist/loader.js foo.ts

*/

import {transformSync, type TransformOptions} from 'esbuild';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {existsSync} from 'node:fs'; // eslint-disable-line @typescript-eslint/no-restricted-imports
import {DEV} from 'esm-env';
import {cwd} from 'node:process';

import {render_env_shim_module} from './util/sveltekit_shim_env.js';

const dir = cwd();

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

const env_matcher = /src\/lib\/\$env\/(static|dynamic)\/(public|private)$/u;
const ts_matcher = /\.(ts|tsx|mts|cts)$/u;

export const load = async (
	url: string,
	context: LoadContext,
	nextLoad: NextLoad,
): Promise<LoadReturn> => {
	// TODO BLOCK how to shim $env? does the specifier need to be modified in `resolve`, or just shortCircuited?
	console.log(`load ` + url);
	const matched_env = env_matcher.exec(url);
	if (matched_env) {
		const mode: 'static' | 'dynamic' = matched_env[1] as any;
		const visibility: 'public' | 'private' = matched_env[2] as any;
		console.log(
			`render_env_shim_module(DEV, mode, visibility, 'PUBLIC_', '')`,
			render_env_shim_module(DEV, mode, visibility, 'PUBLIC_', ''),
		);
		return {
			format: 'module',
			shortCircuit: true,
			source: render_env_shim_module(DEV, mode, visibility, 'PUBLIC_', ''), // TODO BLOCK source from svelte.config.js with a helper that caches
		};
	} else if (ts_matcher.test(url)) {
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
	if (!parent_path) return nextResolve(specifier, context);

	const external = specifier[0] !== '.' && specifier[0] !== '$'; // TODO BLOCK scan for $lib, $routes, and the other config
	if (external) return nextResolve(specifier, context);

	console.log(`specifier`, specifier, parent_path);

	if (
		specifier === '$env/static/public' ||
		specifier === '$env/static/private' ||
		specifier === '$env/dynamic/public' ||
		specifier === '$env/dynamic/private'
	) {
		// The returned `url` is validated before `load` is called,
		// so we need a slightly roundabout strategy to pass through the specifier for virtual files.
		return {url: 'file:///' + dir + '/src/lib/' + specifier, format: 'module', shortCircuit: true};
	}

	let path = specifier;

	// TODO BLOCK handle:
	// $lib
	// ending with .js or .ts or no path and then try .ts and then .js

	if (path.startsWith('$lib')) {
		// TODO BLOCK read svelte.config.js and map $routes, etc
		path = dir + '/src/' + path.substring(1);
		console.log(`path`, path);
	}

	const relative = path[0] === '.';
	const absolute = path[0] === '/';
	if (!relative && !absolute) throw Error('UNEXPECTED path: ' + path); // TODO BLOCK

	if (relative || absolute) {
		if (path.endsWith('.js')) {
			const js_path = relative ? join(parent_path, '../', path) : path;
			// TODO this was supposedly unflagged for Node 20.6 but it's still undefined for me
			// await import.meta.resolve(path);
			if (existsSync(js_path)) {
				path = js_path;
			} else {
				const ts_path = js_path.slice(0, -3) + '.ts';
				if (existsSync(ts_path)) {
					path = ts_path;
				}
			}
		} else {
			// TODO BLOCK refactor with the above
			const js_path = (relative ? join(parent_path, '../', path) : path) + '.js';
			if (existsSync(js_path)) {
				path = js_path;
			} else {
				const ts_path = js_path.slice(0, -3) + '.ts';
				if (existsSync(ts_path)) {
					path = ts_path;
				}
			}
		}
	}
	console.log(`final path`, path);

	return {url: pathToFileURL(path).href, format: 'module', shortCircuit: true};
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
