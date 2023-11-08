# config

Gro supports SvelteKit apps, Node libraries, and Node servers with minimal abstraction
with the help of an optional config file that lives at the root `gro.config.ts`.
If a project does not define a config, Gro imports a default config from
[`src/lib/gro.config.default.ts`](/src/lib/gro.config.default.ts),
which looks at your project for the familiar patterns and tries to do the right thing.

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
import type {Create_Gro_Config} from '@grogarden/gro';

const config: Create_Gro_Config = async (cfg) => {
	// mutate `cfg` or return a new object
	return cfg;
};

export default config;
```

The default export of a Gro config is `Gro_Config | Create_Gro_Config`:

```ts
export interface Create_Gro_Config {
	(base_config: Gro_Config): Gro_Config | Promise<Gro_Config>;
}

export interface Gro_Config {
	plugins: Create_Config_Plugins;
	map_package_json: Map_Package_Json | null;
}
```

To define a user config that overrides the default plugins:

```ts
import type {Create_Gro_Config} from '@grogarden/gro';

const config: Create_Gro_Config = async (cfg) => {
	// example setting your own plugins:
	cfg.plugins = async () => [
		(await import('@grogarden/gro/gro_plugin_sveltekit_frontend.js')).plugin(),
		(await import('./src/custom_plugin.js')).plugin(),
	];

	// example extending the default plugins:
	const get_base_plugins = cfg.plugins;
	cfg.plugins = async (ctx) => {
		// replace a base plugin with `import {replace_plugin} from '@grogarden/gro';`:
		const updated_plugins = replace_plugin(
			await get_base_plugins(ctx),
			(await import('@grogarden/gro/gro_plugin_sveltekit_frontend.js')).plugin({
				// host_target?: Host_Target;
				// well_known_package_json?: boolean | Map_Package_Json;
			}),
			// 'gro_plugin_sveltekit_frontend', // optional name if they don't match
		);
		return updated_plugins.concat(create_some_custom_plugin());
	};
	return cfg;
};

export default config;
```

See also [Gro's own internal config](/gro.config.ts).

## `plugins`

The `plugins` property is a function that returns an array of `Plugin` instances.
Read more about plugins and the `Plugin` in
[plugin.md](plugin.md), [dev.md](dev.md#plugin), and [build.md](build.md#plugin).

```ts
export interface Create_Config_Plugins<T_Plugin_Context extends Plugin_Context = Plugin_Context> {
	(
		ctx: T_Plugin_Context,
	):
		| (Plugin<T_Plugin_Context> | null | Array<Plugin<T_Plugin_Context> | null>)
		| Promise<Plugin<T_Plugin_Context> | null | Array<Plugin<T_Plugin_Context> | null>>;
}
```

## `map_package_json`

The Gro config option `map_package_json` hooks into Gro's `package.json` automations.
The `gro sync` task, which is called during the dev and build tasks among others,
performs several steps to get a project's state ready,
including `svelte-kit sync` and `package.json` automations.
When the `map_package_json` config value is truthy,
Gro outputs a mapped version of the root `package.json`.

> The `gro check` task integrates with `map_package_json` to ensure everything is synced.

The main purpose of `map_package_json` is to automate
the `"exports"` property of your root `package.json`.
The motivation is to streamline package publishing by supplementing
[`@sveltejs/package`](https://kit.svelte.dev/docs/packaging).

By default `pkg.exports` includes everything from `$lib/`
except for some ignored files like tests and markdown,
and you can provide your own `map_package_json` hook to
mutate the `pkg`, return new data, or return `null` to be a no-op.

Typical usage modifies `pkg.exports` during this step to define the public API.

### using `map_package_json`

```ts
// gro.config.ts
const config: Gro_Config = {
	// ...other config

	// disable mapping `package.json` with automated `exports`:
	map_package_json: null,

	// mutate anything and return the final config (can be async):
	map_package_json: (pkg) => {
		// example setting `exports`:
		pkg.exports = {
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
		pkg.exports = Object.fromEntries(Object.entries(pkg.exports).filter(/* ... */));
		return pkg; // returning `null` is a no-op
	},
};

export interface Map_Package_Json {
	(pkg: Package_Json): Package_Json | null | Promise<Package_Json | null>;
}
```
