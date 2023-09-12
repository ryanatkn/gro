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

Here's a config for a simple Node project:

```ts
import type {GroConfigCreator} from '@feltjs/gro';

const config: GroConfigCreator = async () => {
	return {
		builds: [{name: 'server', input: 'index.ts'}],
	};
};

export default config;
```

Here's [Gro's own internal config](/src/gro.config.ts) and
here's [the default config](/src/lib/config/gro.config.default.ts)
that's used for projects that do not define one at `src/gro.config.ts`.

The [`GroConfigPartial`](/src/gro.config.ts) is the return value of config files:

```ts
export interface GroConfigPartial {
	readonly builds: (BuildConfigPartial | null)[] | BuildConfigPartial | null;
	readonly plugin?: ToConfigPlugins;
	readonly adapt?: ToConfigAdapters;
	readonly target?: EcmaScriptTarget; // defaults to 'es2020'
	readonly sourcemap?: boolean; // defaults to true in `dev`, false for prod
}
```

### `builds`

The `builds` property of the Gro config
is an array of build configs that describe a project's outputs.
Here's the [`BuildConfigPartial`](/src/lib/build/build_config.ts) type,
which is the user-facing version of the [`BuildConfig`](/src/lib/build/build_config.ts):

```ts
export interface BuildConfigPartial {
	readonly name: string;
	readonly input: BuildConfigInput | BuildConfigInput[];
}
```

The `name` property can be anything and maps to the build's output directory name.
By defining `"name": "foo",`, running `gro dev` or `gro build` creates builds
in `.gro/dev/foo/` and `.gro/prod/foo/`, respectively.

> Importantly, **Gro requires a Node build named `"node"`**
> that it uses to run things like tests, tasks, and codegen.
> Ideally this would be configurable, but doing so would slow Gro down in many cases.

The `input` property specifies the source code entry points for the build.
Each input must be a file path (absolute or relative to `src/`),
or a filter function with the signature `(id: string) => boolean`.
To define filters, it's convenient to use the
[`createFilter` helper](https://github.com/rollup/plugins/tree/master/packages/pluginutils#createFilter)
from [`@rollup/pluginutils`](https://github.com/rollup/plugins).

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
