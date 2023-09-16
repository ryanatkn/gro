# config

Gro's config is part of a system for building a source project
to one or more output artifacts.
It's designed for a variety of needs:

- support multiple use cases in one source project
  like SvelteKit apps, Node libraries, and Node servers
- support multiple build targets like legacy/modern ES versions and mobile/desktop frontends
- support multiple packages created from one source project to be published separately
- support dev and prod builds that coexist on the filesystem

To accomplish this, Gro has an optional config file that lives at `$PROJECT/src/gro.config.ts`.
If a project does not define a config, Gro imports a default config from
[`src/lib/config/gro.config.default.ts`](/src/lib/config/gro.config.default.ts),
which looks at your project for familiar patterns (like Node libraries and SvelteKit apps)
and tries to do the right thing.

> The [default config](/src/lib/config/gro.config.default.ts)
> detects three types of projects that can coexist:
> SvelteKit frontends, Node libraries published with SvelteKit, and Node servers.

See [`src/lib/config/config.ts`](/src/lib/config/config.ts) for the config types and implementation.

## examples

Here's [Gro's own internal config](/src/gro.config.ts) and
here's [the default config](/src/lib/config/gro.config.default.ts)
that's used for projects that do not define one at `src/gro.config.ts`.

The [`GroConfigPartial`](/src/gro.config.ts) is the return value of config files:

```ts
export interface GroConfigPartial {
	readonly plugin?: ToConfigPlugins;
	readonly adapt?: ToConfigAdapters;
	readonly target?: EcmaScriptTarget; // defaults to 'esnext'
	readonly sourcemap?: boolean;
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
