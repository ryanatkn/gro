/*

usage: node --loader @grogarden/gro/loader.js foo.ts

usage in Gro after `npm run build`: node --loader ./dist/loader.js foo.ts

*/

import * as esbuild from 'esbuild';
import {compile, preprocess} from 'svelte/compiler';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {dirname, join, relative} from 'node:path';
import {cwd} from 'node:process';
import type {LoadHook, ResolveHook} from 'node:module';
import {escape_regexp} from '@grogarden/util/regexp.js';

import {render_env_shim_module} from './sveltekit_shim_env.js';
import {
	render_sveltekit_shim_app_environment,
	render_sveltekit_shim_app_paths,
	sveltekit_shim_app_environment_matcher,
	sveltekit_shim_app_paths_matcher,
	sveltekit_shim_app_specifiers,
} from './sveltekit_shim_app.js';
import {init_sveltekit_config} from './sveltekit_config.js';
import {NODE_MODULES_DIRNAME, SourceId} from './paths.js';
import {to_define_import_meta_env, ts_transform_options} from './esbuild_helpers.js';
import {resolve_specifier} from './resolve_specifier.js';
import { load_package_json,  } from './package_json.js';

// TODO support transitive dependencies for Svelte files in node_modules
// TODO sourcemaps, including esbuild, svelte, and the svelte preprocessors
// TODO `import.meta.resolve` doesn't seem to be available in loaders?

// dev is always true in the loader
const dev = true;

const dir = cwd() + '/';

const {
	alias,
	base_url,
	assets_url,
	env_dir,
	private_prefix,
	public_prefix,
	svelte_compile_options,
	svelte_preprocessors,
} = await init_sveltekit_config(dir); // always load it to keep things simple ahead

const final_ts_transform_options: esbuild.TransformOptions = {
	...ts_transform_options,
	define: to_define_import_meta_env(dev, base_url),
};

const aliases = Object.entries({$lib: 'src/lib', ...alias});

const ts_matcher = /\.(ts|tsx|mts|cts)$/u;
const svelte_matcher = /\.(svelte)$/u;
const json_matcher = /\.(json)$/u;
const env_matcher = /src\/lib\/\$env\/(static|dynamic)\/(public|private)$/u;
const node_modules_matcher = new RegExp(escape_regexp('/' + NODE_MODULES_DIRNAME + '/'), 'u');

export const load: LoadHook = async (url, context, nextLoad) => {
	if (sveltekit_shim_app_paths_matcher.test(url)) {
		// $app/paths shim
		return {
			format: 'module',
			shortCircuit: true,
			source: render_sveltekit_shim_app_paths(base_url, assets_url),
		};
	} else if (sveltekit_shim_app_environment_matcher.test(url)) {
		// $app/environment shim
		return {
			format: 'module',
			shortCircuit: true,
			source: render_sveltekit_shim_app_environment(dev),
		};
	} else if (ts_matcher.test(url)) {
		// ts
		const loaded = await nextLoad(
			url,
			context.format === 'module' ? context : {...context, format: 'module'}, // TODO dunno why this is needed, specifically with tests
		);
		const transformed = await esbuild.transform(
			loaded.source!.toString(), // eslint-disable-line @typescript-eslint/no-base-to-string
			final_ts_transform_options,
		);
		return {format: 'module', shortCircuit: true, source: transformed.code};
	} else if (svelte_matcher.test(url)) {
		// svelte
		const loaded = await nextLoad(
			url,
			context.format === 'module' ? context : {...context, format: 'module'}, // TODO dunno why this is needed, specifically with tests
		);
		const raw_source = loaded.source!.toString(); // eslint-disable-line @typescript-eslint/no-base-to-string
		const preprocessed = svelte_preprocessors
			? await preprocess(raw_source, svelte_preprocessors, {
					filename: relative(dir, fileURLToPath(url)),
			  })
			: null;
		const source = preprocessed?.code ?? raw_source;
		const transformed = compile(source, svelte_compile_options);
		return {format: 'module', shortCircuit: true, source: transformed.js.code};
	} else if (json_matcher.test(url)) {
		// json
		// TODO probably follow esbuild and also export every top-level property for objects from the module - https://esbuild.github.io/content-types/#json (type generation?)
		const loaded = await nextLoad(url);
		const raw_source = loaded.source!.toString(); // eslint-disable-line @typescript-eslint/no-base-to-string
		const source = `export default ` + raw_source;
		return {format: 'module', shortCircuit: true, source};
	} else {
		// neither ts nor svelte
		const matched_env = env_matcher.exec(url);
		if (matched_env) {
			const mode: 'static' | 'dynamic' = matched_env[1] as any;
			const visibility: 'public' | 'private' = matched_env[2] as any;
			return {
				format: 'module',
				shortCircuit: true,
				source: await render_env_shim_module(
					dev,
					mode,
					visibility,
					public_prefix,
					private_prefix,
					env_dir,
				),
			};
		}
	}

	return nextLoad(url, context);
};

export const resolve: ResolveHook = async (specifier, context, nextResolve) => {
	const parent_url = context.parentURL;
	if (!parent_url || node_modules_matcher.test(parent_url)) {
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
		return {
			url: pathToFileURL(join(dir, 'src/lib', specifier)).href,
			format: 'module',
			shortCircuit: true,
		};
	}

	const shimmed = sveltekit_shim_app_specifiers.get(specifier);
	if (shimmed !== undefined) {
		return nextResolve(shimmed, context);
	}

	let path = specifier;

	// Map the path with the SvelteKit aliases.
	for (const [from, to] of aliases) {
		if (path.startsWith(from)) {
			path = join(dir, to, path.substring(from.length));
			break;
		}
	}

	// The specifier `path` has now been mapped to its final form, so we can inspect it.
	if (path[0] !== '.' && path[0] !== '/') {
		// Resolve to `node_modules`.
		// TODO BLOCK JSON and TS too?
		if (svelte_matcher.test(path)) {
			// Svelte needs special handling to match Vite and esbuild, because Node doesn't know.
			const source_id = await resolve_node_specifier(path, parent_url, dir);
			return {url: pathToFileURL(source_id).href, format: 'module', shortCircuit: true};
		} else {
			return nextResolve(path, context);
		}
	}

	const {source_id} = await resolve_specifier(path, dirname(fileURLToPath(parent_url)));

	return {url: pathToFileURL(source_id).href, format: 'module', shortCircuit: true};
};

// TODO BLOCK move this to a new `resolve_node_specifier.ts` module if it's not hacky
const resolve_node_specifier = async (specifier: string, parent_url: string, dir: string): Promise<SourceId> => {
	// TODO BLOCK implement properly -- lookup/cache package.json and resolve from `exports`, falling back to bare if not present (or throwing like the builtin?)
	console.log(`specifier`, specifier);
	console.log(`parent_url`, parent_url);
	const parsed = parse_node_specifier(specifier);
	const subpath = './' + parsed.path;
	console.log(`parsed`, parsed);
	const package_dir = join(dir, NODE_MODULES_DIRNAME, parsed.name);
	const package_json = await load_package_json(package_dir);
	const exported = package_json.exports?.[subpath];
	if (!exported) {
		// This error matches Node's.
		throw Error(`[ERR_PACKAGE_PATH_NOT_EXPORTED]: Package subpath '${subpath}' is not defined by "exports" in ${package_dir}/package.json imported from ${parent_url}`)
	}
	console.log(`package_json.exports`, package_json.exports);
	console.log(`ex`, exported);
	const source_id = join(package_dir, exported.svelte || exported.default); // TODO hacky, should detect file type
	console.log(`source_id`, source_id);
	return source_id;
};

interface ParsedNodeSpecifier {
	name: string;
	path: string;
}

const parse_node_specifier = (specifier: string): ParsedNodeSpecifier => {
	let idx!: number;
	if (specifier[0] === '@') {
		// get the index of the second `/`
		let count = 0;
		for (let i = 0; i < specifier.length; i++) {
			if (specifier[i] === '/') count++;
			if (count === 2) {
				idx = i;
				break;
			}
		}
	} else {
		idx = specifier.indexOf('/');
	}
	return {
		name: specifier.substring(0, idx),
		path: specifier.substring(idx + 1),
	};
};
