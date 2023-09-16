# config

Gro supports SvelteKit apps, Node libraries, and Node servers with minimal abstraction
with the help of an optional config file that lives at `$PROJECT/src/gro.config.ts`.
If a project does not define a config, Gro imports a default config from
[`src/lib/config/gro.config.default.ts`](/src/lib/config/gro.config.default.ts),
which looks at your project for the familiar patterns and tries to do the right thing.

> The [default config](/src/lib/config/gro.config.default.ts)
> detects three types of projects that can coexist in one repo:
> SvelteKit frontends,
> Node libraries with [`@sveltejs/package`](https://kit.svelte.dev/docs/packaging),
> and Node servers.

See [`src/lib/config/config.ts`](/src/lib/config/config.ts) for the config types and implementation.

## examples

Here's [Gro's own internal config](/src/gro.config.ts) and
here's [the default config](/src/lib/config/gro.config.default.ts)
that's used for projects that do not define one at `src/gro.config.ts`.

The default export of a Gro config is `GroConfig | GroConfigCreator`:

```ts
export interface GroConfig {
	readonly plugin: ToConfigPlugins;
	readonly adapt: ToConfigAdapters;
}

export interface GroConfigCreator {
	(default_config: GroConfig): GroConfig | Promise<GroConfig>;
}
```

### `plugin`

The `plugin` property is a function that returns any number of `Plugin` instances.
Read more about `plugin` and the `Plugin` in
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

### `adapt`

The `adapt` property is a function that returns any number of `Adapter` instances.
Read more about `adapt` and the `Adapter` in [adapt.md](adapt.md) and [build.md](build.md#adapt).

```ts
export interface ToConfigAdapters<TArgs = any> {
	(
		ctx: AdapterContext<TArgs>,
	):
		| (Adapter<TArgs> | null | Array<Adapter<TArgs> | null>)
		| Promise<Adapter<TArgs> | null | Array<Adapter<TArgs> | null>>;
}
```
