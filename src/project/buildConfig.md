# build config

Gro's build config is part of a system for compiling a source project
to one or more output projects.
It's designed for a variety of use cases:

- support dev and prod builds to separate directories
- support multiple output targets like legacy and modern Node and ES versions
- support multiple platform targets like Node and browsers
- support multiple packages created from one codebase to be published separately

To accomplish this, Gro has the `BuildConfig` type
which defines some JSON metadata for each build.
See [`./buildConfig.ts`](./buildConfig.ts) for the implementation.

A Gro project's build configs must be statically knowable before compilation,
because there's a chicken and egg problem -
if a config is defined in TypeScript,
we need to compile it to execute and read it,
but to compile it we need the config - so we're stuck.
This can be solved in other ways,
like compiling to a temporary directory or using something like `ts-node`,
but these solutions introduce overhead and complexity we'd rather avoid.

So for now, Gro reads a single field from a project's `package.json`.
Here's Gro's own settings as a Node-only project:

```jsonc
{
	// gro/package.json
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

Here's the fallback default for projects that do not define anything:

```jsonc
{
	// some-project/package.json
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
with a legacy client fallback:

```jsonc
{
	// some-project/package.json
	"gro": {
		"builds": [
			{
				"name": "node",
				"platform": "node"
			},
			{
				"name": "browser",
				"platform": "browser"
			},
			{
				"name": "browser_legacy",
				"platform": "browser"
			}
		]
	}
}
```
