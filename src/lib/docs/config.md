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
property of the repo's `package.json` to the filesystem during the dev and build tasks.

When `when === 'updating_well_known'`, Gro is outputting a second `package.json`
to `.well-known/package.json` in your SvelteKit static directory during the dev and build tasks.

> ⚠️ Warning: by default Gro copies your root `package.json`
> to the SvelteKit static directory in `.well-known/package.json`
> unless the `package.json` has `"private": true`.
> This may surprise some users and could result in unwanted information leaks.
> Gro's defaults are designed for for open source projects,
> but it should work just as well for private projects, and configuration should remain simple.
> To mitigate the issues, the `package.json` is written to `.well-known` during development
> and expected to be committed to source control, giving visibility and requiring a manual step.
> To disable all of Gro's `package.json` behavior, configure `package_json: () => null,`.

```ts
const config: GroConfig = {
	// ...other config

	// the default behavior:
	// outputs all of `$lib/` as `exports` and the full `.well-known/package.json`,
	// unless `private` is true, in which case both are disabled
	package_json: (pkg) => pkg?.private ? null : pkg,

	// outputs both regardless of the value of `private`
	package_json: (pkg) => pkg,

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
};

export interface MapPackageJson {
	(
		pkg: PackageJson | null,
		when: MapPackageJsonWhen,
	): PackageJson | null | Promise<PackageJson | null>;
}

export type MapPackageJsonWhen = 'updating_exports' | 'updating_well_known';

```

Writing to `.well-known/package.json` is unstandardized behavior that
repurposes [Well-known URIs](https://en.wikipedia.org/wiki/Well-known_URIs) for Node packages
to provide conventional metadata for deployed websites.
The motivating usecase is [a docs website](https://docs.fuz.dev/) that includes many repos
and avoids duplicating any sources of truth.
By using a conventional URI deployed to the web instead of using the git repos directly,
we gain some benefits:

- the motivating usecase depends on the metadata of many repos, but not their content
- users have full control with an automation-friendly pattern,
  because the `package_json` config property decouples the output json from the repo's root `package.json`
