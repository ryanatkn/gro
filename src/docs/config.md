# config

Gro's config is part of a system for building a source project
to one or more output artifacts.
It's designed for a variety of use cases:

- support dev and prod builds that coexist on the filesystem
- support multiple build targets like legacy/modern ES versions and mobile/desktop frontends
- support multiple platform targets like Node and browsers, including server-side rendering
- support multiple packages created from one codebase to be published separately

To accomplish this, Gro has an optional config file that lives at `$PROJECT/src/gro.config.ts`.
If a project does not define a config, Gro imports a default config from
[`src/config/gro.config.default.ts`](/src/config/gro.config.default.ts).

> The default config detects
> [Gro's deprecated SPA mode](https://github.com/feltcoop/gro/issues/106)
> if it sees both a `src/index.html` and `src/index.ts`.
> It also looks for a Node server entry point at `src/server/server.ts`.
> Both are no-ops if not detected.

See [`src/config/config.ts`](/src/config/config.ts) for the config types and implementation.

## examples

Here's a config for a simple Node project:

```ts
import type {GroConfigCreator} from '@feltcoop/gro/dist/config/config.js';

export const config: GroConfigCreator = async () => {
	return {
		builds: [{name: 'node', platform: 'node', input: 'index.ts'}],
	};
};
```

Here's what a frontend-only project with both desktop and mobile builds may look like:

```ts
import type {GroConfigCreator} from '@feltcoop/gro/dist/config/config.js';
import {createFilter} from '@rollup/pluginutils';

export const config: GroConfigCreator = async () => {
	return {
		builds: [
			{name: 'browser_mobile', platform: 'browser', input: 'index.ts', adapt: mobileAdapter()},
			{name: 'browser_desktop', platform: 'browser', input: 'index.ts', adapt: desktopAdapter()},
			{name: 'node', platform: 'node', input: createFilter('**/*.{task,test,gen}*.ts')},
		],
	};
};
```

Here's [Gro's own internal config](/src/gro.config.ts) and
here's [the default config](/src/config/gro.config.default.ts)
that's used for projects that do not define one at `src/gro.config.ts`.

The [`GroConfigPartial`](/src/gro.config.ts) is the return value of config files:

```ts
export interface GroConfigPartial {
	readonly builds: BuildConfigPartial[];
	readonly target?: EcmaScriptTarget;
	readonly sourcemap?: boolean;
	readonly host?: string; // env.GRO_HOST
	readonly port?: number; // env.GRO_PORT
	readonly logLevel?: LogLevel; // env.GRO_LOG_LEVEL
	readonly serve?: ServedDirPartial[];
}
```

[Gro's internal config](/src/gro.config.ts) uses the `serve` property
to serve the contents of both `src/` and `src/client/` off of the root directory.

```ts
serve: [toBuildOutPath(true, 'browser', 'client'), toBuildOutPath(true, 'browser', '')],
```

```ts
type ServedDirPartial =
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

## build config

The `builds` property of the Gro config
is an array of build configs that describe a project's outputs.
Here's the [`BuildConfigPartial`](/src/config/buildConfig.ts) type,
which is the user-facing version of the [`BuildConfig`](/src/config/buildConfig.ts):

```ts
export interface BuildConfigPartial {
	readonly name: string;
	readonly platform: PlatformTarget; // 'node' | 'browser'
	readonly input: BuildConfigInput | BuildConfigInput[];
}
```

The `name` field can be anything and maps to the build's output directory name.
By defining `"name": "foo",`, running `gro dev` or `gro build` creates builds
in `.gro/dev/foo/` and `.gro/prod/foo/`, respectively.

> Importantly, **Gro requires a Node build named `"node"`**
> that it uses to run things like tests, tasks, and codegen.
> Ideally this would be configurable, but doing so would slow Gro down in many cases.

The `platform` can currently be `"node"` or `"browser"` and
is used by Gro's default builders to customize the output.
When building for the browser, dependencies in `node_modules/` are imported via Snowpack's
[`esinstall`](https://github.com/snowpackjs/snowpack/tree/master/esinstall).
When building for Node, the Svelte compiler outputs
[SSR components](https://svelte.dev/docs#Server-side_component_API)
instead of the normal DOM ones.

The `input` field specifies the source code entry points for the build.
Each input must be a file path (absolute or relative to `src/`),
or a filter function with the signature `(id: string) => boolean`.
To define filters, it's convenient to use the
[`createFilter` helper](https://github.com/rollup/plugins/tree/master/packages/pluginutils#createFilter)
from `@rollup/pluginutils` and
Gro's own [`createDirectoryFilter` helper](../build/utils.ts).
