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
It's also passed as the first argument to `GroConfigCreator`.

A simple config that does nothing:

```ts
// gro.config.ts
import type {GroConfigCreator} from '@grogarden/gro';

const config: GroConfigCreator = async (cfg) => {
	// mutate `cfg` or return a new object
	return cfg;
};

export default config;
```

The default export of a Gro config is `GroConfig | GroConfigCreator`:

```ts
export interface GroConfigCreator {
	(base_config: GroConfig): GroConfig | Promise<GroConfig>;
}

export interface GroConfig {
	plugins: CreateConfigPlugins;
	package_json: MapPackageJson;
}
```

To define a user config that overrides the default plugins:

```ts
import type {GroConfigCreator} from '@grogarden/gro';

const config: GroConfigCreator = async (cfg) => {
	const get_base_plugins = cfg.plugins;
	cfg.plugins = async (_ctx) => {
		const base_plugins = await get_base_plugins();
		return base_plugins.concat(create_some_custom_plugin());
	};
	return cfg;
};

export default config;
```

See also [Gro's own internal config](/gro.config.ts).

## `plugins`

The `plugin` property is a function that returns any number of `Plugin` instances.
Read more about plugins and the `Plugin` in
[plugin.md](plugin.md), [dev.md](dev.md#plugin), and [build.md](build.md#plugin).

```ts
export interface CreateConfigPlugins<TPluginContext extends PluginContext = PluginContext> {
	(
		ctx: TPluginContext,
	):
		| (Plugin<TPluginContext> | null | Array<Plugin<TPluginContext> | null>)
		| Promise<Plugin<TPluginContext> | null | Array<Plugin<TPluginContext> | null>>;
}
```

## `package_json`

The Gro config option `package_json` hooks into Gro's `package.json` automations.
The `gro exports` task, which is called during the dev and build tasks,
performs two separate steps that both call `package_json` to determine their behavior:

- when `when === 'updating_exports'`, Gro is updating the repo's `package.json` `"exports"` property
- when `when === 'updating_well_known'`, Gro is outputting a copy of `package.json`
  to `.well-known/package.json` in the repo's static SvelteKit directory

Similar to other tasks like `gro gen` and `gro format`,
the `gro exports` task supports `gro exports --check`,
which is called by `gro check`, to ensure the repo and Gro's automations are in sync.

### using `package_json`

```ts
// gro.config.ts
const config: GroConfig = {
	// ...other config

	// the default behavior:
	// outputs all of `$lib/` as `exports` and the full `.well-known/package.json`,
	// unless `private` is true, in which case both are disabled
	package_json: (pkg) => (pkg?.private ? null : pkg),

	// outputs the full versions of both regardless of the value of `private`
	package_json: (pkg) => pkg,

	// disables generation of both automatic `exports` and `.well-known/package.json`
	package_json: () => null,

	// disable `.well-known/package.json` and enable writing `exports` to `package.json`
	package_json: (pkg, when) => (when === 'updating_well_known' ? null : pkg),

	// disable writing `exports` to `package.json` and enable `.well-known/package.json`
	package_json: (pkg, when) => (when === 'updating_exports' ? null : pkg),

	// mutate anything and return the final config
	package_json: (pkg, when) => {
		// filter `exports`
		pkg.exports = Object.fromEntries(Object.entries(pkg.exports).filter(/* ... */));
		// remove properties
		if (when === 'updating_well_known') pkg.prettier = undefined;
		// add properties
		if (when === 'updating_well_known') pkg.created_at = new Date().toISOString();
		return pkg;
	},
};

export interface MapPackageJson {
	(pkg: PackageJson, when: MapPackageJsonWhen): PackageJson | null | Promise<PackageJson | null>;
}

export type MapPackageJsonWhen = 'updating_exports' | 'updating_well_known';
```

### when 'updating_exports'

Gro automatically updates the `"exports"` property of your root `package.json`
during the dev and build tasks unless `package.json` has `"private": true`.
The motivation is to streamline package publishing by supplementing
[`@sveltejs/package`](https://kit.svelte.dev/docs/packaging).

The `when` param will be `'updating_exports'` during this step.
By default it includes everything from `$lib/`,
and you can provide your own `package_json` hook to
mutate the `pkg`, return new data, or return `null` to be a no-op.

Typical usage would modify `pkg.exports` during this step to
remove modules that aren't public API.

### when 'updating_well_known'

By default Gro copies your root `package.json`
to the SvelteKit static directory in `.well-known/package.json`
unless `package.json` has `"private": true`.
The motivation is to provide conventional package metadata to web users and tools.

The `when` param will be `'updating_exports'` during this step.
By default it copies the root `package.json` without modifications,
and you can provide your own `package_json` hook to
mutate the `pkg`, return new data, or return `null` to be a no-op.

> Writing to `.well-known/package.json` is unstandardized behavior that
> extends [Well-known URIs](https://wikipedia.org/wiki/Well-known_URIs) for Node packages
> to provide conventional metadata for deployed websites.
> One difference is that SvelteKit outputs static files relative to the configured `base` path,
> so the `.well-known` directory may not be in the root `/`.
> This is useful because it enables websites to provide metadata even when hosted in a namespaced
> path like `username.github.io/projectname/.well-known`.

Why publish this metadata to the web instead of relying on the git repo as the only source of truth?

- we want to give all web users and tools access to discoverable package metadata
- metadata is a much lighter dependency than an entire repo
- some repos are deployed to multiple websites with metadata differences
- some repos like monorepos have multiple `package.json` files
- we don't want to force a dependency on git, the bespoke URLs of forge hosts like GitHub,
  or any particular toolchains
- the git repo is still the source of truth, but Gro adds a build step for project metadata,
  giving devs full control over the published artifacts
  instead of coupling metadata directly to a source repo's `package.json`

> ⚠️ Outputting `.well-known/package.json` will surprise some users
> and could result in information leaks that compromise privacy or security.
> Gro's defaults are designed for open source projects,
> but configuring closed private projects should remain simple.
> To migitate these issues:
>
> - all `package.json` automations are disabled when `"private": true`
>   (templates should default to private to avoid accidental npm publishing as well)
> - the `package.json` is written to `.well-known` during development
>   and it's expected to be committed to source control,
>   giving visibility and requiring developers to opt into adding the file with git -
>   the alternative of outputting it to the SvelteKit build may appear cleaner,
>   but Gro's position is that hiding it is worse in this case
>   (maybe it should be configurable, but that complexity has costs too)
