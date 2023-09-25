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
Here's how to define a user config that overrides the default plugins:

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

## details

```ts
export interface GroConfig {
	plugins: CreateConfigPlugins;
	/**
	 * Maps the project's `package.json`.
	 * Runs in modes 'updating_exports' and 'updating_well_known'.
	 * The `pkg` argument may be mutated.
	 */
	package_json: MapPackageJson;
}

export interface GroConfigCreator {
	(base_config: GroConfig): GroConfig | Promise<GroConfig>;
}
```

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

The Gro config `package_json` property is a callback function
that lets you modify the `package.json` in different circumstances.

When `when === 'updating_exports'`, Gro is writing the `"exports"`
property of the repo's `package.json` to the filesystem as part of the build process.

When `when === 'updating_well_known'`, Gro is outputting a second `package.json`
to `.well-known/package.json` in your SvelteKit static directory.

> ⚠️ Warning: by default Gro outputs your root `package.json`
> to the SvelteKit static directory in `.well-known/package.json`.
> This may surprise some users, and may result in unwanted information leaks.
> To mitigate issues while keeping Gro's preferred defaults,
> which are optimized for open source projects, the file is generated during development
> and expected to be committed to source control, so at least there's visibility.
> To disable all Gro `package.json` behavior, set `package_json: () => null,`.

> Writing to `.well-known/package.json` is unstandardized behavior that
> repurposes [.well-known URIs](https://en.wikipedia.org/wiki/Well-known_URIs) for Node packages
> to provide a metadata convention for deployed websites.
> The motivating usecase is [a docs website](https://docs.fuz.dev/) that spans many repos
> and avoids duplicating any sources of truth.
> By decoupling the output json from the repo's root `package.json`
> with the `package_json` config property, we give users full control with minimal config.

```ts
export interface MapPackageJson {
	(
		pkg: PackageJson | null,
		when: MapPackageJsonWhen,
	): PackageJson | null | Promise<PackageJson | null>;
}

export type MapPackageJsonWhen = 'updating_exports' | 'updating_well_known';

const config: GroConfig = {
	// ...

	// the default, outputs all of `$lib/` as `exports` and the full `.well-known/package.json`
	package_json: (pkg, _when) => pkg,

	// disables both automatic `exports` generation to `package.json` and `.well-known/package.json`
	package_json: () => null,

	// disable `.well-known/package.json` and enable writing `exports` to `package.json`
	package_json: (pkg, when) => (when === 'updating_well_known' ? null : pkg),

	// disable writing `exports` to `package.json` and enable `.well-known/package.json`
	package_json: (pkg, when) => (when === 'updating_exports' ? null : pkg),

	// change anything you want and return the final config
	package_json: (pkg, when) => {
		pkg.exports = Object.fromEntries(Object.entries(pkg.entries).map((e) => /* ... */));
		if (when === 'updating_well_known') delete pkg['prettier'];
		return pkg;
	},
}
```
