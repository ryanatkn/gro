import * as esbuild from 'esbuild';
import {compile, compileModule, preprocess} from 'svelte/compiler';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {dirname, join} from 'node:path';
import type {LoadHook, ResolveHook} from 'node:module';
import {escape_regexp} from '@ryanatkn/belt/regexp.js';
import {readFileSync} from 'node:fs';

import {render_env_shim_module} from './sveltekit_shim_env.js';
import {
	render_sveltekit_shim_app_environment,
	render_sveltekit_shim_app_paths,
	SVELTEKIT_SHIM_APP_ENVIRONMENT_MATCHER,
	SVELTEKIT_SHIM_APP_PATHS_MATCHER,
	sveltekit_shim_app_specifiers,
} from './sveltekit_shim_app.js';
import {default_sveltekit_config} from './sveltekit_config.js';
import {SVELTE_MATCHER, SVELTE_RUNES_MATCHER} from './svelte_helpers.js';
import {IS_THIS_GRO, paths} from './paths.js';
import {JSON_MATCHER, NODE_MODULES_DIRNAME, TS_MATCHER} from './constants.js';
import {to_define_import_meta_env, default_ts_transform_options} from './esbuild_helpers.js';
import {resolve_specifier} from './resolve_specifier.js';
import {map_sveltekit_aliases} from './sveltekit_helpers.js';

// TODO get out of the loader business, starting with https://nodejs.org/api/typescript.html#type-stripping

/*

Usage via `$lib/register.ts`:

```bash
node --import @ryanatkn/gro/register.js foo.ts
```

Usage via `$lib/run.task.ts`:

```bash
gro run foo.ts
```

Direct usage without register (see also `$lib/gro.ts`):

```bash
node --import 'data:text/javascript,import {register} from "node:module"; import {pathToFileURL} from "node:url"; register("@ryanatkn/gro/loader.js", pathToFileURL("./"));' --enable-source-maps' foo.ts
```

TODO how to improve that gnarly import line? was originally designed for the now-deprecated `--loader`

*/

// TODO sourcemaps for the svelte preprocessors
// TODO `import.meta.resolve` wasn't available in loaders when this was first implemented, but might be now

// dev is always true in the loader
const dev = true;

const dir = paths.root;

const {
	alias,
	base_url,
	assets_url,
	env_dir,
	private_prefix,
	public_prefix,
	svelte_compile_options,
	svelte_compile_module_options,
	svelte_preprocessors,
} = default_sveltekit_config;

const ts_transform_options: esbuild.TransformOptions = {
	...default_ts_transform_options,
	define: to_define_import_meta_env(dev, base_url),
	sourcemap: 'inline',
};

const aliases = Object.entries(alias);

const RAW_MATCHER = /(%3Fraw|\.css|\.svg)$/; // TODO others? configurable?
const ENV_MATCHER = /src\/lib\/\$env\/(static|dynamic)\/(public|private)$/;
const NODE_MODULES_MATCHER = new RegExp(escape_regexp('/' + NODE_MODULES_DIRNAME + '/'), 'u');

export const load: LoadHook = async (url, context, nextLoad) => {
	if (SVELTEKIT_SHIM_APP_PATHS_MATCHER.test(url)) {
		// SvelteKit `$app/paths` shim
		return {
			format: 'module',
			shortCircuit: true,
			source: render_sveltekit_shim_app_paths(base_url, assets_url),
		};
	} else if (SVELTEKIT_SHIM_APP_ENVIRONMENT_MATCHER.test(url)) {
		// SvelteKit `$app/environment` shim
		return {
			format: 'module',
			shortCircuit: true,
			source: render_sveltekit_shim_app_environment(dev),
		};
	} else if (SVELTE_RUNES_MATCHER.test(url)) {
		// Svelte runes in js/ts
		const loaded = await nextLoad(
			url,
			context.format === 'module' ? context : {...context, format: 'module'}, // TODO dunno why this is needed, specifically with tests
		);
		const filename = fileURLToPath(url);
		const source = loaded.source!.toString(); // eslint-disable-line @typescript-eslint/no-base-to-string
		const js_source = TS_MATCHER.test(url)
			? (await esbuild.transform(source, {...ts_transform_options, sourcefile: url})).code // TODO @many use warnings? handle not-inline sourcemaps?
			: source;
		const transformed = compileModule(js_source, {...svelte_compile_module_options, dev, filename});
		return {format: 'module', shortCircuit: true, source: transformed.js.code};
	} else if (TS_MATCHER.test(url)) {
		// ts
		const loaded = await nextLoad(
			url,
			context.format === 'module' ? context : {...context, format: 'module'}, // TODO dunno why this is needed, specifically with tests
		);
		const source = loaded.source!.toString(); // eslint-disable-line @typescript-eslint/no-base-to-string
		const transformed = await esbuild.transform(source, {...ts_transform_options, sourcefile: url}); // TODO @many use warnings? handle not-inline sourcemaps?
		return {format: 'module', shortCircuit: true, source: transformed.code};
	} else if (SVELTE_MATCHER.test(url)) {
		// Svelte
		const loaded = await nextLoad(
			url,
			context.format === 'module' ? context : {...context, format: 'module'}, // TODO dunno why this is needed, specifically with tests
		);
		const raw_source = loaded.source!.toString(); // eslint-disable-line @typescript-eslint/no-base-to-string
		const filename = fileURLToPath(url);
		const preprocessed = svelte_preprocessors // TODO @many use sourcemaps (and diagnostics?)
			? await preprocess(raw_source, svelte_preprocessors, {filename})
			: null;
		const source = preprocessed?.code ?? raw_source;
		const transformed = compile(source, {...svelte_compile_options, dev, filename});
		return {format: 'module', shortCircuit: true, source: transformed.js.code};
	} else if (JSON_MATCHER.test(url)) {
		// json
		// TODO probably follow esbuild and also export every top-level property for objects from the module - https://esbuild.github.io/content-types/#json (type generation?)
		const loaded = await nextLoad(url);
		const raw_source = loaded.source!.toString(); // eslint-disable-line @typescript-eslint/no-base-to-string
		const source = `export default ` + raw_source;
		return {format: 'module', shortCircuit: true, source};
	} else if (RAW_MATCHER.test(url)) {
		// raw text imports like `?raw`, `.css`, `.svg`
		const filename = fileURLToPath(url.endsWith('%3Fraw') ? url.substring(0, url.length - 6) : url);
		const raw_source = readFileSync(filename, 'utf8');
		const source =
			'export default `' + raw_source.replaceAll('\\', '\\\\').replaceAll('`', '\\`') + '`;';
		return {format: 'module', shortCircuit: true, source};
	} else {
		const matched_env = ENV_MATCHER.exec(url);
		if (matched_env) {
			// SvelteKit `$env`
			const mode: 'static' | 'dynamic' = matched_env[1] as any;
			const visibility: 'public' | 'private' = matched_env[2] as any;
			return {
				format: 'module',
				shortCircuit: true,
				source: render_env_shim_module(
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

	// fallback to default behavior
	return nextLoad(url, context);
};

export const resolve: ResolveHook = async (specifier, context, nextResolve) => {
	let s = specifier;

	// Support SvelteKit `$env` imports
	if (
		s === '$env/static/public' ||
		s === '$env/static/private' ||
		s === '$env/dynamic/public' ||
		s === '$env/dynamic/private'
	) {
		// The returned `url` is validated before `load` is called,
		// so we need a slightly roundabout strategy to pass through the specifier for virtual files.
		return {
			url: pathToFileURL(join(dir, 'src/lib', s)).href,
			format: 'module',
			shortCircuit: true,
		};
	}

	// Special case for Gro's dependencies that import into Gro.
	// Without this, we'd need to add a dev dep to Gro for Gro, which causes problems.
	// TODO maybe make this generic, checking `package_json.name` against `s` and map it, possibly need to export `resolve_exported_value`
	if (IS_THIS_GRO && s.startsWith('@ryanatkn/gro')) {
		s = join(dir, 'dist', s.substring(13));
	}

	const parent_url = context.parentURL;
	if (!parent_url || NODE_MODULES_MATCHER.test(parent_url)) {
		return nextResolve(s, context);
	}

	const shimmed = sveltekit_shim_app_specifiers.get(s);
	if (shimmed !== undefined) {
		return nextResolve(shimmed, context);
	}

	s = map_sveltekit_aliases(s, aliases);

	// The specifier has now been mapped to its final form, so we can inspect it.

	// Imports into `node_modules` use the default algorithm, and the rest use use Vite conventions.
	if (s[0] !== '.' && s[0] !== '/') {
		return nextResolve(s, context);
	}

	const resolved = resolve_specifier(s, dirname(fileURLToPath(parent_url)));

	return {
		url: pathToFileURL(resolved.path_id_with_querystring).href,
		format: 'module',
		shortCircuit: true,
	};
};
