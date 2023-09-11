/*

usage: node --loader @feltjs/gro/loader.js foo.ts

usage in Gro: node --loader ./dist/loader.js foo.ts

*/

import {transformSync, type TransformOptions} from 'esbuild';
import {compile} from 'svelte/compiler';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {existsSync} from 'node:fs';
import {cwd} from 'node:process';
import type {LoadHook, ResolveHook} from 'node:module';

import {render_env_shim_module} from './util/sveltekit_shim_env.js';
import {to_sveltekit_app_specifier} from './util/sveltekit_shim_app.js';
import {load_sveltekit_config} from './util/sveltekit_config.js';

const dir = cwd() + '/';

const sveltekit_config = await load_sveltekit_config(dir); // was lazy-loaded, but can't be imported during `resolve`, fails silently
const alias = sveltekit_config?.kit?.alias;
const public_prefix = sveltekit_config?.kit?.env?.publicPrefix;
const private_prefix = sveltekit_config?.kit?.env?.privatePrefix;
const env_dir = sveltekit_config?.kit?.env?.dir;
const compiler_options = sveltekit_config?.compilerOptions;

const transformOptions: TransformOptions = {
	target: 'esnext',
	// TODO add support - runtime lookup to `source-map-support`,
	// maybe caching everything here to the filesystem, both source and sourcemaps,
	// or perhaps compile the sourcemaps lazily only when retrieved
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

const env_matcher = /src\/lib\/\$env\/(static|dynamic)\/(public|private)$/u;
const ts_matcher = /\.(ts|tsx|mts|cts)$/u;
const svelte_matcher = /\.(svelte)$/u;

export const load: LoadHook = async (url, context, nextLoad) => {
	const matched_env = env_matcher.exec(url);
	if (matched_env) {
		const mode: 'static' | 'dynamic' = matched_env[1] as any;
		const visibility: 'public' | 'private' = matched_env[2] as any;
		return {
			format: 'module',
			shortCircuit: true,
			// TODO BLOCK how to get `dev`, because `DEV` is production for Gro!
			source: render_env_shim_module(
				true,
				mode,
				visibility,
				public_prefix,
				private_prefix,
				env_dir,
			),
		};
	} else if (ts_matcher.test(url)) {
		const loaded = await nextLoad(url, {...context, format: 'module'});
		// TODO maybe do path mapping in an esbuild plugin here instead of the resolve hook?
		const transformed = transformSync(loaded.source!.toString(), transformOptions); // eslint-disable-line @typescript-eslint/no-base-to-string
		return {format: 'module', shortCircuit: true, source: transformed.code};
	} else if (svelte_matcher.test(url)) {
		const loaded = await nextLoad(url, {...context, format: 'module'});
		// TODO maybe do path mapping in a Svelte preprocessor here instead of the resolve hook?
		// TODO include `filename` and `outputFilename` and enable sourcemaps
		// TODO cache by content hash
		const transformed = compile(loaded.source!.toString(), compiler_options); // eslint-disable-line @typescript-eslint/no-base-to-string
		return {format: 'module', shortCircuit: true, source: transformed.js.code};
	}

	return nextLoad(url, context);
};

export const resolve: ResolveHook = async (specifier, context, nextResolve) => {
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

	const shimmed = to_sveltekit_app_specifier(specifier);
	if (shimmed !== null) {
		return nextResolve(shimmed, context);
	}

	let path = specifier;

	// Map the specifier with the SvelteKit aliases.
	const aliases = {$lib: 'src/lib', ...alias};
	for (const [from, to] of Object.entries(aliases)) {
		if (path.startsWith(from)) {
			path = dir + to + path.substring(from.length);
			break;
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
	if (!path.endsWith('.js')) js_path += '.js'; // TODO BLOCK handle `.ts` imports too, and svelte, and ignore `.(schema|task.` etc, same helpers as esbuild plugin for server
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
