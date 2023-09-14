/*

usage: node --loader @feltjs/gro/loader.js foo.ts

usage in Gro: node --loader ./dist/loader.js foo.ts

*/

import * as esbuild from 'esbuild';
import {compile, preprocess} from 'svelte/compiler';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {join, sep} from 'node:path';
import {cwd} from 'node:process';
import type {LoadHook, ResolveHook} from 'node:module';
import {escapeRegexp} from '@feltjs/util/regexp.js';

import {render_env_shim_module} from './util/sveltekit_shim_env.js';
import {to_sveltekit_app_specifier} from './util/sveltekit_shim_app.js';
import {init_sveltekit_config} from './util/sveltekit_config.js';
import {exists} from './util/exists.js';
import {NODE_MODULES_DIRNAME} from './util/paths.js';
import {to_define_import_meta_env, transform_options} from './util/esbuild_helpers.js';
import {resolve_specifier} from './util/resolve_specifier.js';

const dir = cwd() + '/';
const node_modules_matcher = new RegExp(escapeRegexp(sep + NODE_MODULES_DIRNAME + sep), 'u');

const {
	alias,
	base_url,
	env_dir,
	private_prefix,
	public_prefix,
	svelte_compile_options,
	svelte_preprocessors,
} = await init_sveltekit_config(dir); // always load it to keep things simple ahead

const env_matcher = /src\/lib\/\$env\/(static|dynamic)\/(public|private)$/u;
const ts_matcher = /\.(ts|tsx|mts|cts)$/u;
const svelte_matcher = /\.(svelte)$/u;

export const load: LoadHook = async (url, context, nextLoad) => {
	if (node_modules_matcher.test(url)) {
		return nextLoad(url, context);
	}
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
	const parent_url = context.parentURL;
	if (!parent_url || node_modules_matcher.test(parent_url)) {
		return nextResolve(specifier, context);
	}

	console.log('RESOLVING ' + specifier, context.parentURL);

	if (
		specifier === '$env/static/public' ||
		specifier === '$env/static/private' ||
		specifier === '$env/dynamic/public' ||
		specifier === '$env/dynamic/private'
	) {
		// The returned `url` is validated before `load` is called,
		// so we need a slightly roundabout strategy to pass through the specifier for virtual files.
		return {
			url: pathToFileURL(join(dir, 'src/lib', specifier)).href,
			format: 'module',
			shortCircuit: true,
		};
	}

	const shimmed = to_sveltekit_app_specifier(specifier);
	if (shimmed !== null) {
		return nextResolve(shimmed, context);
	}

	// TODO BLOCK resolve_specifier
	let path = specifier;

	// Map the path with the SvelteKit aliases.
	// TODO BLOCK extract a more efficient helper and use it in both places
	const aliases = {$lib: 'src/lib', ...alias};
	for (const [from, to] of Object.entries(aliases)) {
		if (path.startsWith(from)) {
			path = join(dir, to, path.substring(from.length));
			break;
		}
	}

	// The specifier `path` has now been mapped to its final form, so we can inspect it.
	if (path[0] !== '.' && path[0] !== '/') {
		return nextResolve(path, context);
	}

	// TODO `import.meta.resolve` was supposedly unflagged for Node 20.6 but I'm still seeing it as undefined
	// await import.meta.resolve(path);

	const importer = fileURLToPath(parent_url);
	const resolved = await resolve_specifier(path, importer); // TODO BLOCK maybe the directory is optional if there's an absolute path?

	return {url: pathToFileURL(resolved.specifier).href, format: 'module', shortCircuit: true};
};
