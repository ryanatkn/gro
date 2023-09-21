# config

Gro supports SvelteKit apps, Node libraries, and Node servers with minimal abstraction
with the help of an optional config file that lives at `$PROJECT/gro.config.ts`.
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

Here's [Gro's own internal config](/gro.config.ts) and
here's [the default config](/src/lib/gro.config.default.ts)
that's used for projects that do not define one at `gro.config.ts`.

The default export of a Gro config is `GroConfig | GroConfigCreator`.
Here's how to define a user config that overrides the default adapters and plugins:

```ts
import type {GroConfigCreator} from '@grogarden/gro';

const config: GroConfigCreator = async (default_config) => {
	const final_config = {
		...default_config,
		adapters: () => {
			const default_adapters = await default_config.adapters();
			return default_adapters.concat(create_some_custom_adapter());
		},
		plugins: () => {
			const default_plugins = await default_config.plugins();
			return default_plugins.concat(create_some_custom_plugin());
		},
	};
	return final_config;
};

export default config;
```

## details

```ts
export interface GroConfig {
	plugins: ToConfigPlugins;
	adapters: ToConfigAdapters;
}

export interface GroConfigCreator {
	(default_config: GroConfig): GroConfig | Promise<GroConfig>;
}
```

## `plugins`

The `plugin` property is a function that returns any number of `Plugin` instances.
Read more about plugins and the `Plugin` in
[plugin.md](plugin.md), [dev.md](dev.md#plugin), and [build.md](build.md#plugin).

```ts
export interface ToConfigPlugins<TPluginContext extends PluginContext = PluginContext> {
	(
		ctx: TPluginContext,
	):
		| (Plugin<TPluginContext> | null | Array<Plugin<TPluginContext> | null>)
		| Promise<Plugin<TPluginContext> | null | Array<Plugin<TPluginContext> | null>>;
}
```

## `adapters`

The `adapters` property is a function that returns any number of `Adapter` instances.
Read more about adapters and the `Adapter` in [adapt.md](adapt.md) and [build.md](build.md#adapt).

```ts
export interface ToConfigAdapters<TArgs = any> {
	(
		ctx: AdapterContext<TArgs>,
	):
		| (Adapter<TArgs> | null | Array<Adapter<TArgs> | null>)
		| Promise<Adapter<TArgs> | null | Array<Adapter<TArgs> | null>>;
}
```
