# config

Gro's config is part of a system for building a source project
to one or more output artifacts.
It's designed for a variety of needs:

- support multiple use cases in one source project
  like SvelteKit apps, Node libraries, and API servers
- support multiple build targets like legacy/modern ES versions and mobile/desktop frontends
- support multiple platform targets like Node and browsers, including server-side rendering
- support multiple packages created from one source project to be published separately
- support dev and prod builds that coexist on the filesystem

To accomplish this, Gro has an optional config file that lives at `$PROJECT/src/gro.config.ts`.
If a project does not define a config, Gro imports a default config from
[`src/config/gro.config.default.ts`](/src/config/gro.config.default.ts),
which looks at your project for familiar patterns (like Node libraries and SvelteKit apps)
and tries to do the right thing.

> The default config detects
> [Gro's deprecated SPA mode](https://github.com/feltcoop/gro/issues/106)
> if it sees both a `src/index.html` and `src/index.ts`.
> It also looks for a Node server entry point at `src/server/server.ts`.
> Both are no-ops if not detected.

See [`src/config/config.ts`](/src/config/config.ts) for the config types and implementation.

## examples

Here's a config for a simple Node project:

```ts
import type {Gro_Config_Creator} from '@feltcoop/gro';

export const config: Gro_Config_Creator = async () => {
	return {
		builds: [{name: 'server', platform: 'node', input: 'index.ts'}],
	};
};
```

Here's [Gro's own internal config](/src/gro.config.ts) and
here's [the default config](/src/config/gro.config.default.ts)
that's used for projects that do not define one at `src/gro.config.ts`.

The [`Gro_Config_Partial`](/src/gro.config.ts) is the return value of config files:

```ts
export interface Gro_Config_Partial {
	readonly builds: (Build_Config_Partial | null)[] | Build_Config_Partial | null;
	readonly publish?: string | null; // dir for `gro publish`, defaults to 'dist/library' if it exists
	readonly plugin?: To_Config_Plugins;
	readonly adapt?: To_Config_Adapters;
	readonly target?: Ecma_Script_Target; // defaults to 'es2020'
	readonly sourcemap?: boolean; // defaults to true in `dev`, false for prod
	readonly typemap?: boolean; // defaults to false in `dev`, true for prod
	readonly types?: boolean; // defaults to false
	readonly host?: string; // env.GRO_HOST
	readonly port?: number; // env.GRO_PORT
	readonly log_level?: Log_Level; // env.GRO_LOG_LEVEL
	readonly serve?: Served_Dir_Partial[];
}
```

### `builds`

The `builds` property of the Gro config
is an array of build configs that describe a project's outputs.
Here's the [`Build_Config_Partial`](/src/build/build_config.ts) type,
which is the user-facing version of the [`Build_Config`](/src/build/build_config.ts):

```ts
export interface Build_Config_Partial {
	readonly name: string;
	readonly platform: Platform_Target; // 'node' | 'browser'
	readonly input: Build_Config_Input | Build_Config_Input[];
}
```

The `name` property can be anything and maps to the build's output directory name.
By defining `"name": "foo",`, running `gro dev` or `gro build` creates builds
in `.gro/dev/foo/` and `.gro/prod/foo/`, respectively.

> Importantly, **Gro requires a Node build named `"node"`**
> that it uses to run things like tests, tasks, and codegen.
> Ideally this would be configurable, but doing so would slow Gro down in many cases.

The `platform` property can currently be `"node"` or `"browser"` and
is used by Gro's default builders to customize the output.
When building for the browser, dependencies in `node_modules/` are imported via Snowpack's
[`esinstall`](https://github.com/snowpackjs/snowpack/tree/master/esinstall).
When building for Node, the Svelte compiler outputs
[SSR components](https://svelte.dev/docs#Server-side_component_API)
instead of the normal DOM ones.

The `input` property specifies the source code entry points for the build.
Each input must be a file path (absolute or relative to `src/`),
or a filter function with the signature `(id: string) => boolean`.
To define filters, it's convenient to use the
[`createFilter` helper](https://github.com/rollup/plugins/tree/master/packages/pluginutils#createFilter)
from `@rollup/pluginutils` and
Gro's own [`createDirectoryFilter` helper](../build/utils.ts).

### `plugin`

The `plugin` property is a function that returns any number of `Plugin` instances.
Read more about `plugin` and the `Plugin` in
[plugin.md](plugin.md), [dev.md](dev.md#plugin), and [build.md](build.md#plugin).

```ts
export interface To_Config_Plugins<T_Args = any, T_Events = any> {
	(ctx: Plugin_Context<T_Args, T_Events>):
		| (Plugin<T_Args, T_Events> | null | (Plugin<T_Args, T_Events> | null)[])
		| Promise<Plugin<T_Args, T_Events> | null | (Plugin<T_Args, T_Events> | null)[]>;
}
```

### `adapt`

The `adapt` property is a function that returns any number of `Adapter` instances.
Read more about `adapt` and the `Adapter` in [adapt.md](adapt.md) and [build.md](build.md#adapt).

```ts
export interface To_Config_Adapters<T_Args = any, T_Events = any> {
	(ctx: Adapter_Context<T_Args, T_Events>):
		| (Adapter<T_Args, T_Events> | null | (Adapter<T_Args, T_Events> | null)[])
		| Promise<Adapter<T_Args, T_Events> | null | (Adapter<T_Args, T_Events> | null)[]>;
}
```

### `serve`

[Gro's internal config](/src/gro.config.ts) uses the `serve` property
to serve the content of both `src/` and `src/client/` off of the root directory.

```ts
serve: [to_build_out_path(true, 'browser', 'client'), to_build_out_path(true, 'browser', '')],
```

```ts
type Served_Dir_Partial =
	| string
	| {
			path: string;
			root?: string;
			base?: string;
	  };
```

The optional `root` property can be paired with the directories passed to `serve`:

```ts
config = {
	serve: [
		{path: '/some/path', root: '/some'},

		// no root by default; these are all equivalent:
		'/a',
		{path: '/a'},
		{path: '/a', root: ''},
		{path: '/a', root: '.'},
		{path: '/a', root: './'},
	],
};
```

The optional `base` property is used by `serve` to mimic the production behavior
of static deployments like GitHub pages:

```ts
config = {
	serve: [
		{path: '/', base: 'my-package-name'}, // served at e.g. `myname.github.io/my-package-name`

		// no base by default; these are all equivalent:
		'/a',
		{path: '/a'},
		{path: '/a', base: ''},
		{path: '/a', base: '/'},
		{path: '/a', base: '.'},
		{path: '/a', base: './'},
	],
};
```
