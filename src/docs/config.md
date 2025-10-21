# config

Gro supports SvelteKit apps, Node libraries, and Node servers with minimal abstraction
with the help of an optional config file that lives at the root `gro.config.ts`.
If a project does not define a config, Gro imports a default config from
[`src/lib/gro.config.default.ts`](/src/lib/gro.config.default.ts),
which looks at your project for the familiar patterns and tries to do the right thing,
without required deps.

> The [default config](/src/lib/gro.config.default.ts)
> detects three types of projects that can coexist in one repo:
> SvelteKit frontends,
> Node libraries with [`@sveltejs/package`](https://kit.svelte.dev/docs/packaging),
> and Node servers.

See [`src/lib/config.ts`](/src/lib/config.ts) for the config types and implementation.

## examples

[The default config](/src/lib/gro.config.default.ts)
is used for projects that do not define `gro.config.ts`.
It's also passed as the first argument to `Create_Gro_Config`.

A simple config that does nothing:

```ts
// gro.config.ts
import type {Create_Gro_Config} from '@ryanatkn/gro';

const config: Create_Gro_Config = async (cfg) => {
	// mutate `cfg` or return a new object
	return cfg;
};

export default config;
```

The default export of a Gro config is `Gro_Config | Create_Gro_Config`:

```ts
export interface Create_Gro_Config {
	(base_config: Gro_Config): Raw_Gro_Config | Promise<Raw_Gro_Config>;
}

// The strict variant that's used internally and exposed to users in tasks and elsewhere.
export interface Gro_Config extends Raw_Gro_Config {
	plugins: Create_Config_Plugins;
	map_package_json: Map_Package_Json | null;
	task_root_dirs: Array<Path_Id>;
	search_filters: Array<Path_Filter>;
	js_cli: string;
	pm_cli: string;
}

// The relaxed variant that users can provide. Superset of `Gro_Config`.
export interface Raw_Gro_Config {
	plugins?: Create_Config_Plugins;
	map_package_json?: Map_Package_Json | null;
	task_root_dirs?: Array<string>;
	search_filters?: Path_Filter | Array<Path_Filter> | null;
	js_cli?: string;
	pm_cli?: string;
}
```

To define a user config that overrides the default plugins:

```ts
import type {Create_Gro_Config} from '@ryanatkn/gro';
import {gro_plugin_sveltekit_app} from '@ryanatkn/gro/gro_plugin_sveltekit_app.js';

const config: Create_Gro_Config = async (cfg) => {
	// `cfg`, which has type `Gro_Config` and is equal to `create_empty_gro_config()`,
	// can be mutated or you can return your own.
	// A return value is required to avoid potential errors and reduce ambiguity.

	// example setting your own plugins):
	cfg.plugins = async () => [
		gro_plugin_sveltekit_app(),
		(await import('./src/custom_plugin.js')).plugin(),
	];

	// example extending the default plugins:
	const get_base_plugins = cfg.plugins;
	cfg.plugins = async (ctx) => {
		// replace a base plugin with `import {replace_plugin} from '@ryanatkn/gro';`:
		const updated_plugins = replace_plugin(
			await get_base_plugins(ctx),
			gro_plugin_sveltekit_app({
				// host_target?: Host_Target;
				// well_known_package_json?: boolean | Map_Package_Json;
			}),
			// 'gro_plugin_sveltekit_app', // optional name if they don't match
		);
		return updated_plugins.concat(create_some_custom_plugin());
		// `return get_base_plugins(ctx)` is the base behavior
	};

	return cfg; // return type is `Raw_Gro_Config`, which is a relaxed superset of `Gro_Config`
};

export default config;
```

You can also export a config object and use `create_empty_gro_config` to get the defaults:

```ts
import {create_empty_gro_config} from '@ryanatkn/gro/gro_config.js';

const config = create_empty_gro_config();

// config.plugins = ...;
// config.map_package_json = ...;
// config.task_root_dirs = ...;
// config.search_filters = ...;
// config.js_cli = ...;
// config.pm_cli = ...;

export default config;
```

See also [Gro's own internal config](/gro.config.ts).

## `plugins`

The `plugins` property is a function that returns an array of `Plugin` instances.
Read more about plugins and the `Plugin` in
[plugin.md](plugin.md), [dev.md](dev.md#plugin), and [build.md](build.md#plugin).

```ts
export type Create_Config_Plugins<T_Plugin_Context extends Plugin_Context = Plugin_Context> = (
	ctx: T_Plugin_Context,
) => Array<Plugin<T_Plugin_Context>> | Promise<Array<Plugin<T_Plugin_Context>>>;
```

## `map_package_json`

The Gro config option `map_package_json` hooks into Gro's `package.json` automations.
The `gro sync` task, which is called during the dev and build tasks among others,
performs several steps to get a project's state ready,
including `svelte-kit sync` and `package.json` automations.

When the `map_package_json` config value is truthy,
`gro sync` writes to the root `package.json` on the filesystem with a mapped version.
To opt out, configure `map_package_json` to `null` or return `null` from it.

> The `gro check` task integrates with `map_package_json` to ensure everything is synced.

The main purpose of `map_package_json` is to automate
the `"exports"` property of your root `package.json`.
The motivation is to streamline package publishing by supplementing
[`@sveltejs/package`](https://kit.svelte.dev/docs/packaging).

By default `package_json.exports` uses subpath wildcard patterns to include everything from `$lib/`
except for some ignored files like tests and markdown,
and you can provide your own `map_package_json` hook to
mutate and return the `package_json`, return a new one,
or return `null` to opt out of transforming it completely.

### using `map_package_json`

```ts
// gro.config.ts
const config: Gro_Config = {
	// ...other config

	// default behavior is the identity function:
	map_package_json: (p) => p,

	// disable mapping `package.json` with automated `exports`:
	map_package_json: null,

	// mutate anything and return the final config (can be async):
	map_package_json: (package_json) => {
		// example setting `exports`:
		package_json.exports = {
			'.': {
				default: './dist/index.js',
				types: './dist/index.d.ts',
			},
			'./example.js': {
				default: './dist/example.js',
				types: './dist/example.d.ts',
			},
			'./Example.svelte': {
				svelte: './dist/Example.svelte',
				types: './dist/Example.svelte.d.ts',
			},
		};
		// example filtering `exports`:
		package_json.exports = Object.fromEntries(
			Object.entries(package_json.exports).filter(/* ... */),
		);
		return package_json; // returning `null` is a no-op
	},
};

export interface Map_Package_Json {
	(package_json: Package_Json): Package_Json | null | Promise<Package_Json | null>;
}
```

## `task_root_dirs`

The Gro config option `task_root_dirs` allows customizing Gro's task resolution.
When calling `gro [input_path]`, absolute and explicitly relative paths starting with `.`
are resolved according to normal filesystem rules,
but non-explicit input paths, like `foo`, are resolved by searching
through `task_root_dirs` in order until a matching file or directory is found on the filesystem.

The default task paths are `./src/lib`, then `.`, and then Gro's dist directory.

## `search_filters`

The Gro config option `search_filters` allows customizing
how Gro searches for tasks and genfiles on the filesystem.
Directories and files are included if they pass all of these filters.

By default, it uses the `SEARCH_EXCLUDER_DEFAULT` to exclude
dot-prefixed directories, node_modules,
and the build and dist directories for SvelteKit and Gro.

## `js_cli`

> ⚠️ support is currently partial, help is welcome

The CLI to use that's compatible with `node`.

## `pm_cli`

> ⚠️ support is currently partial, help is welcome

The CLI to use that's compatible with `npm install` and `npm link`.
Defaults to `'npm'`.

## `build_cache_config`

The `build_cache_config` option allows you to define **custom** build inputs
that invalidate the [build cache](build.md#build-caching) when they change.
Gro automatically tracks your source code (git commit hash), dependencies (lock files),
and standard config files—use `build_cache_config` when your build depends on
**additional factors** like environment variables, external data, or feature flags.

**Important:** This value is hashed before being stored in the cache metadata.
The raw value is never logged or written to disk, protecting sensitive information.

### when to use `build_cache_config`

Gro's build cache automatically invalidates when your **source code, dependencies, or
config files** change (see [build caching](build.md#build-caching) for details).
Use `build_cache_config` to add custom factors when your build output also depends on:

- **Environment variables** baked into the build (API endpoints, feature flags)
- **External data files** that affect the build (content databases, configuration data)
- **Runtime feature flags** that change build behavior
- **Build-time constants** from non-standard sources

### basic usage

```ts
// gro.config.ts
import type {Gro_Config} from '@ryanatkn/gro';
import {readFileSync} from 'node:fs';

export default {
	build_cache_config: {
		// Environment variables that affect the build
		api_endpoint: process.env.PUBLIC_API_URL,
		analytics_key: process.env.PUBLIC_ANALYTICS_KEY,

		// External data that influences the build
		data_version: readFileSync('data/version.txt', 'utf-8'),

		// Feature flags
		features: {
			enable_analytics: true,
			enable_beta_ui: false,
		},
	},
} satisfies Gro_Config;
```

Any change to these values will trigger a fresh build, even if source code hasn't changed.

### async function usage

For complex scenarios, you can provide an async function:

```ts
// gro.config.ts
export default {
	build_cache_config: async () => {
		const config_data = await fetch('https://api.example.com/build-config').then((r) => r.json());

		return {
			remote_config_version: config_data.version,
			feature_flags: config_data.flags,
		};
	},
} satisfies Gro_Config;
```

### security considerations

The `build_cache_config` value is **hashed** before being written to `build/.build-meta.json`.
Only the hash is stored, never the raw values, so it's safe to include:

- API keys (though using them at build time should be carefully considered)
- Internal URLs
- Configuration secrets

However, be aware that these values may still appear in:

- Build outputs if your code embeds them
- Build logs if explicitly logged elsewhere
- The config file itself (ensure `gro.config.ts` is not publicly committed if it contains secrets)

### how it works

The build cache validates multiple factors to determine if a rebuild is needed
(see [build caching](build.md#build-caching)). For `build_cache_config` specifically, Gro:

1. Resolves `build_cache_config` (calls it if it's a function)
2. Serializes the result to JSON
3. Hashes the JSON string using SHA-256
4. Compares the hash against the previous build's hash
5. If this hash **or any other cache factor** differs, invalidates the cache and rebuilds

This ensures builds are correct while protecting sensitive configuration.
All cache factors (git commit, lock files, config files, build args, and `build_cache_config`)
are combined—if any single factor changes, the cache is invalidated.
