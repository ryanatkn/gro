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

See [`src/config/config.ts`](/src/config/config.ts) for the config types and implementation.

## examples

Here's a config for a simple Node project:

```ts
import {GroConfigCreator} from '@feltcoop/gro/dist/config/config.js';

const createConfig: GroConfigCreator = async () => {
	return {
		builds: [{name: 'node', platform: 'node', input: 'index.ts'}],
	};
};

export default createConfig;
```

Here's what a frontend-only project with both desktop and mobile builds may look like:

```ts
import {GroConfigCreator} from '@feltcoop/gro/dist/config/config.js';
import {createFilter} from '@rollup/pluginutils';

const createConfig: GroConfigCreator = async () => {
	return {
		builds: [
			{name: 'browser_mobile', platform: 'browser', input: 'index.ts', dist: true},
			{name: 'browser_desktop', platform: 'browser', input: 'index.ts', dist: true, primary: true},
			{name: 'node', platform: 'node', input: createFilter('**/*.{task,test,gen}*.ts')},
		],
	};
};

export default createConfig;
```

Here's [Gro's own internal config](/src/gro.config.ts) and
here's [the default config](/src/config/gro.config.default.ts)
that's used for projects that do not define one at `src/gro.config.ts`.

The [`PartialGroConfig`](/src/gro.config.ts) is the return value of config files:

```ts
export interface PartialGroConfig {
	readonly builds: PartialBuildConfig[];
	readonly target?: EcmaScriptTarget;
	readonly sourceMap?: boolean;
	readonly host?: string;
	readonly port?: number;
	readonly logLevel?: LogLevel;
	readonly serve?: ServedDirPartial[];
}
```

[Gro's internal config](/src/gro.config.ts) uses the `serve` property
to serve the contents of both `src/` and `src/client/` off of the root directory.

```ts
serve: [toBuildOutPath(true, 'browser', 'client'), toBuildOutPath(true, 'browser', '')],
```

An optional `servedAt` property can be paired with the directories passed to `serve`:

```ts
config = {
	serve: [
		{dir: '/some/path', servedAt: '/some'},
		'/a', // is the same as:
		{dir: '/a'},
	],
};
```

## build config

The `builds` property of the Gro config
is an array of build configs that describe a project's outputs.
Here's the [`PartialBuildConfig`](/src/config/buildConfig.ts) type,
which is the user-facing version of the [`BuildConfig`](/src/config/buildConfig.ts):

```ts
export interface PartialBuildConfig {
	readonly name: string;
	readonly platform: PlatformTarget; // 'node' | 'browser'
	readonly input: BuildConfigInput | BuildConfigInput[];
	readonly dist?: boolean;
	readonly primary?: boolean;
}
```

The `name` field can be anything and maps to the build's output directory name.
By defining `"name": "foo",`, running `gro dev`/`gro compile` or `gro build` creates builds
in `.gro/dev/foo/` and `.gro/prod/foo/`, respectively.

> Importantly, **Gro requires a Node build named `"node"`**
> that it uses to run things like tests, tasks, and codegen.
> It must be the primary Node build.
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

The optional `dist` flag marks builds for inclusion in the root `dist/` directory
by [the `gro dist` task](/src/dist.task.ts).
If no `dist` flag is found on any builds, all builds are included.
If multiple builds are found, the `gro dist` task copies their directories into `dist/`,
named according to the `name` build config field.
If one build is found, its contents are put directly into `dist/` with no directory namespacing.
Like all builtin tasks, you can easily customize this behavior
by creating `src/dist.task.ts` in your project and optionally
[invoking the original task](/src/task#run-a-task-inside-another-task).

The optional `primary` flag tells Gro which build of each platform
should be used when doing something that needs exactly one build.
For Node builds, this includes things like running tasks, tests, codegen,
and other Node-related development concerns.
For browser builds, this is the build that's served by the development server.
As mentioned above, the `primary` Node build is always named `"node"`.
For other platforms, if no `primary` flag exists on any build,
Gro marks the first build in the `builds` array as primary.
