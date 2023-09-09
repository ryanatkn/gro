/*

usage: node --loader @feltjs/gro/loader.js foo.ts

usage in Gro: node --loader ./dist/loader.js foo.ts

*/

import {transformSync, type TransformOptions} from 'esbuild';
import {compile} from 'svelte/compiler';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {existsSync} from 'node:fs';
import {DEV} from 'esm-env';
import {cwd} from 'node:process';
import type {Config} from '@sveltejs/kit';

import {render_env_shim_module} from './util/sveltekit_shim_env.js';

const dir = cwd() + '/';

const load_sveltekit_config = async (): Promise<Config | null> => {
	try {
		return (await import(dir + 'svelte.config.js')).default;
	} catch (err) {
		return null;
	}
};

const config = await load_sveltekit_config(); // was lazy-loaded, but can't be imported during `resolve`, fails silently
const alias = config?.kit?.alias;
const public_prefix = config?.kit?.env?.publicPrefix;
const private_prefix = config?.kit?.env?.privatePrefix;
const env_dir = config?.kit?.env?.dir;
const compiler_options = config?.compilerOptions;

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
const svelte_matcher = /\.(svelte)$/u;

export const load = async (
	url: string,
	context: LoadContext,
	nextLoad: NextLoad,
): Promise<LoadReturn> => {
	const matched_env = env_matcher.exec(url);
	if (matched_env) {
		const mode: 'static' | 'dynamic' = matched_env[1] as any;
		const visibility: 'public' | 'private' = matched_env[2] as any;
		return {
			format: 'module',
			shortCircuit: true,
			source: render_env_shim_module(DEV, mode, visibility, public_prefix, private_prefix, env_dir),
		};
	} else if (ts_matcher.test(url)) {
		const loaded = await nextLoad(url, {...context, format: 'module'});
		// TODO maybe do path mapping in an esbuild plugin here instead of the resolve hook?
		const transformed = transformSync(loaded.source.toString(), transformOptions); // eslint-disable-line @typescript-eslint/no-base-to-string
		return {format: 'module', shortCircuit: true, source: transformed.code};
	} else if (svelte_matcher.test(url)) {
		const loaded = await nextLoad(url, {...context, format: 'module'});
		// TODO maybe do path mapping in a Svelte preprocessor here instead of the resolve hook?
		// TODO include `filename` and `outputFilename` and enable sourcemaps
		// TODO cache by content hash
		const transformed = compile(loaded.source.toString(), compiler_options); // eslint-disable-line @typescript-eslint/no-base-to-string
		return {format: 'module', shortCircuit: true, source: transformed.js.code};
	}

	return nextLoad(url, context);
};

export const resolve = async (
	specifier: string,
	context: ResolveContext,
	nextResolve: NextResolve,
): Promise<ResolveReturn> => {
	const parent_path = context.parentURL && fileURLToPath(context.parentURL);
	if (!parent_path?.startsWith(dir) || parent_path.startsWith(dir + 'node_modules/')) {
		return nextResolve(specifier, context);
	}

	if (
		specifier === '$env/static/public' ||
		specifier === '$env/static/private' ||
		specifier === '$env/dynamic/public' ||
		specifier === '$env/dynamic/private'
	) {
		// The returned `url` is validated before `load` is called,
		// so we need a slightly roundabout strategy to pass through the specifier for virtual files.
		return {url: 'file:///' + dir + 'src/lib/' + specifier, format: 'module', shortCircuit: true};
	}

	let path = specifier;

	if (path.startsWith('$lib')) {
		path = dir + 'src/' + path.substring(1);
	}

	if (alias) {
		for (const [from, to] of Object.entries(alias)) {
			if (path.startsWith(from)) {
				path = dir + to + path.substring(from.length);
			}
		}
	}

	// The specifier `path` has now been mapped to its final form, so we can inspect it.
	const relative = path[0] === '.';
	const absolute = path[0] === '/';
	if (!relative && !absolute) {
		// Handle external specifiers imported by internal code.
		return nextResolve(specifier, context);
	}

	// TODO `import.meta.resolves` was supposedly unflagged for Node 20.6 but I'm still seeing it as undefined
	// await import.meta.resolve(path);
	let js_path = relative ? join(parent_path, '../', path) : path;
	if (!path.endsWith('.js')) js_path += '.js';
	if (existsSync(js_path)) {
		path = js_path;
	} else {
		const ts_path = js_path.slice(0, -3) + '.ts';
		if (existsSync(ts_path)) {
			path = ts_path;
		}
	}

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
