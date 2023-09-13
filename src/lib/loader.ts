/*

usage: node --loader @feltjs/gro/loader.js foo.ts

usage in Gro: node --loader ./dist/loader.js foo.ts

*/

import * as esbuild from 'esbuild';
import {loadConfigFromFile} from 'vite';
import {compile, preprocess, type CompileOptions, type PreprocessorGroup} from 'svelte/compiler';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {cwd} from 'node:process';
import type {LoadHook, ResolveHook} from 'node:module';
import type {Config} from '@sveltejs/kit';

import {render_env_shim_module} from './util/sveltekit_shim_env.js';
import {to_sveltekit_app_specifier} from './util/sveltekit_shim_app.js';
import {load_sveltekit_config} from './util/sveltekit_config.js';
import {exists} from './util/exists.js';
import {NODE_MODULES_DIRNAME} from './util/paths.js';
import {to_define_import_meta_env, transform_options} from './util/esbuild_helpers.js';

const dir = cwd() + '/';

console.log('LOADER ENTRY ' + dir);

let alias: Record<string, string> | undefined;
let base_url: '' | `/${string}` | undefined;
let env_dir: string | undefined;
let private_prefix: string | undefined;
let public_prefix: string | undefined;
let svelte_compile_options: CompileOptions | undefined;
let svelte_preprocessors: PreprocessorGroup | PreprocessorGroup[] | undefined;
const init_sveltekit_config = async (): Promise<void> => {
	console.log('init_sveltekit_config');
	const config = await load_sveltekit_config(dir);
	alias = config?.kit?.alias;
	base_url = config?.kit?.paths?.base;
	env_dir = config?.kit?.env?.dir;
	private_prefix = config?.kit?.env?.privatePrefix;
	public_prefix = config?.kit?.env?.publicPrefix;
	svelte_compile_options = config?.compilerOptions;
	svelte_preprocessors = config?.preprocess;
};
await init_sveltekit_config(); // always load it to keep things simple ahead

const env_matcher = /src\/lib\/\$env\/(static|dynamic)\/(public|private)$/u;
const ts_matcher = /\.(ts|tsx|mts|cts)$/u;
const svelte_matcher = /\.(svelte)$/u;

export const load: LoadHook = async (url, context, nextLoad) => {
	console.log(`ENTER load`, url, context);
	const matched_env = env_matcher.exec(url);
	if (matched_env) {
		const mode: 'static' | 'dynamic' = matched_env[1] as any;
		const visibility: 'public' | 'private' = matched_env[2] as any;
		return {
			format: 'module',
			shortCircuit: true,
			// TODO BLOCK how to get `dev`? does esm-env work or is it always prod for gro?
			source: await render_env_shim_module(
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
		// eslint-disable-next-line @typescript-eslint/no-base-to-string
		const transformed = await esbuild.transform(loaded.source!.toString(), {
			...transform_options,
			define: to_define_import_meta_env(true, base_url), // TODO BLOCK other options from config
		});
		return {format: 'module', shortCircuit: true, source: transformed.code};
	} else if (svelte_matcher.test(url)) {
		const loaded = await nextLoad(url, {...context, format: 'module'});
		// TODO maybe do path mapping in a Svelte preprocessor here instead of the resolve hook?
		// TODO include `filename` and `outputFilename` and enable sourcemaps
		// TODO cache by content hash
		console.log(`Svelte preprocess url`, url);
		const raw_source = loaded.source!.toString(); // eslint-disable-line @typescript-eslint/no-base-to-string
		const preprocessed = svelte_preprocessors
			? await preprocess(raw_source, svelte_preprocessors, {filename: url}) // TODO BLOCK make this a path?
			: null;
		// TODO handle preprocessor sourcemaps
		const source = preprocessed?.code ?? raw_source;
		const transformed = compile(source, svelte_compile_options);
		return {format: 'module', shortCircuit: true, source: transformed.js.code};
	}

	return nextLoad(url, context);
};

export const resolve: ResolveHook = async (specifier, context, nextResolve) => {
	// TODO BLOCK fast path for externals,
	// e.g. ///home/ryan/dev/gro/node_modules/svelte/src/compiler/compile/nodes/Comment.js
	console.log('RESOLVING ' + specifier, context.parentURL);
	// TODO BLOCK better detection of cyclic lazily-loaded config files (include Vite, maybe Gro)
	if (specifier.endsWith('svelte.config.js')) {
		return nextResolve(specifier, context);
	}
	const parent_path = context.parentURL && fileURLToPath(context.parentURL);
	if (
		!parent_path?.startsWith(dir) ||
		parent_path.startsWith(join(dir, NODE_MODULES_DIRNAME) + '/')
	) {
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
	const path_is_relative = path[0] === '.';
	const path_is_absolute = path[0] === '/';
	if (!path_is_relative && !path_is_absolute) {
		// Handle external specifiers imported by internal code.
		return nextResolve(specifier, context);
	}

	// TODO `import.meta.resolves` was supposedly unflagged for Node 20.6 but I'm still seeing it as undefined
	// await import.meta.resolve(path);
	// TODO BLOCK needs to be relative?
	let js_path = path_is_relative ? join(parent_path, '../', path) : path;
	if (!path.endsWith('.js')) js_path += '.js'; // TODO BLOCK handle `.ts` imports too, and svelte, and ignore `.(schema|task.` etc, same helpers as esbuild plugin for server
	if (await exists(js_path)) {
		path = js_path;
	} else {
		const ts_path = js_path.slice(0, -3) + '.ts';
		if (await exists(ts_path)) {
			path = ts_path;
		}
	}

	return {url: pathToFileURL(path).href, format: 'module', shortCircuit: true};
};
