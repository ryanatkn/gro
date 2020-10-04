# build config

Gro's build config is part of a system for compiling a source project
to one or more output artifacts.
It's designed for a variety of use cases:

- support dev and prod builds that coexist on the filesystem
- support multiple compilation targets like legacy/modern ES versions and mobile/desktop frontends
- support multiple platform targets like Node and browsers, including server-side rendering
- support multiple packages created from one codebase to be published separately

To accomplish this, Gro has the `BuildConfig` type
which defines some JSON metadata for each build.
See [`./buildConfig.ts`](./buildConfig.ts) for the implementation.
A project can add this data to its `package.json` under a `"gro"` field.

Why put this in `package.json` and not a more powerful `gro.config.ts` file?
A Gro project's build configs must be statically knowable before compilation,
because there's a chicken and egg problem -
if a config is defined in TypeScript,
we need to compile it to execute and read it,
but to compile it we need the config - so we're stuck.
This can be solved in other ways,
like compiling to a temporary directory or using something like `ts-node`,
but these solutions introduce overhead and complexity we'd rather avoid.

So for now, Gro reads a single field from a project's `package.json`.
Here's what a Node project may look like:

```jsonc
{
	// some-node-project/package.json
	"gro": {
		"builds": [
			{
				"name": "node",
				"platform": "node"
			}
		]
	}
}
```

The `"name"` field can be anything and maps to the build's directory name.
The `"platform"` can currently be `"node"` or `"browser"` and
is used by compilers for TypeScript and Svelte.

Here's what a frontend-only project may look like.
It's also the fallback default for projects that do not define anything:

```jsonc
{
	// some-frontend-project/package.json
	"gro": {
		"builds": [
			{
				"name": "browser",
				"platform": "browser"
			}
		]
	}
}
```

Here's an example for a project that creates both server and client builds
with a second client optimized for mobile browsers:

```jsonc
{
	// some-fullstack-project/package.json
	"gro": {
		"builds": [
			{
				"name": "node",
				"platform": "node"
			},
			{
				"name": "browser_desktop",
				"platform": "browser"
			},
			{
				"name": "browser_mobile",
				"platform": "browser"
			}
		]
	}
}
```

## Additional options

The build config has some options. Here's the `BuildConfig` type:

```ts
export interface BuildConfig {
	readonly name: string;
	readonly platform: PlatformTarget;
	readonly dist?: boolean;
}
```

The optional `dist` flag marks builds for inclusion in the root `dist/` directory
by the `dist` task, which you can run via `gro dist`,
and whose code is at [`src/dist.task.ts`](../dist.task.ts).
If no `dist` flag is found on any builds, all builds are included.
If multiple builds are found, the `dist` task copies their directories into `dist/`.
If one build is found, its contents are put directly into `dist/` with no directory namespacing.
Like all builtin tasks, you can easily customize this behavior
by creating `src/dist.task.ts` in your project and optionally
[invoking the original task](../task#run-a-task-inside-another-task).
