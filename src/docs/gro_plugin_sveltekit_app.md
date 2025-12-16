# SvelteKit app plugin

Gro's [SvelteKit app plugin](/src/lib/gro_plugin_sveltekit_app.ts)
calls `vite dev` and `vite build` with some additional behaviors.

```ts
// gro.config.ts
import type {GroConfigCreator} from '@ryanatkn/gro';
import {gro_plugin_sveltekit_app} from '@ryanatkn/gro/gro_plugin_sveltekit_app.js';

const config: GroConfigCreator = async (cfg) => {
	cfg.plugins = async () => [
		// this is included in the default config for SvelteKit projects:
		gro_plugin_sveltekit_app({
			// well_known_package_json?: boolean | MapPackageJson;
			// well_known_source_json?: boolean | MapSourceJson;
			// well_known_src_files?: boolean | CopyFileFilter;
		}),
	];
	return cfg;
};

export default config;

// src/lib/gro_plugin_sveltekit_app.ts
export interface CopyFileFilter {
	(file_path: string): boolean | Promise<boolean>;
}

// src/lib/package_json.ts
export interface MapPackageJson {
	(package_json: PackageJson): PackageJson | null | Promise<PackageJson | null>;
}

// src/lib/source_json.ts
export interface MapSourceJson {
	(source_json: SourceJson): SourceJson | null | Promise<SourceJson | null>;
}
```

## `well_known_package_json`

If your root `package.json` has `"public": true`
(telling Gro it's a [public package](./package_json.md#public-packages)),
by default Gro copies `.well-known/package.json` to `static/` during `vite build`,
so it's included in the SvelteKit build output.
The motivation is to provide conventional package metadata to web users and tools.
(more details below)

> ⚠️ Outputting `.well-known/package.json` will surprise some users
> and could result in information leaks that compromise privacy or security.
> The feature is enabled only when your root `package.json` has `"public": true`.
> Templates that default to public should prominently warn their users.

By default the root `package.json` is copied without modifications,
and you can provide your own `well_known_package_json` option to
mutate the `package_json`, return new data, or return `null` to be a no-op.

> Writing to `.well-known/package.json` is unstandardized behavior that
> extends [Well-known URIs](https://wikipedia.org/wiki/Well-known_URIs) for Node packages
> to provide conventional metadata for deployed websites.
> [Mastodon](<https://en.wikipedia.org/wiki/Mastodon_(social_network)>) uses
> [WebFinger](https://en.wikipedia.org/wiki/WebFinger) which uses `.well-known` for discovery.
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

## `well_known_source_json`

If your root `package.json` has `"public": true`,
by default Gro creates `.well-known/source.json` and `.well-known/src/`
in `static/` during `vite build`,
so they're included in the SvelteKit build output.
More [about public packages](./package_json.md#public-packages).

This can be customized with `well_known_source_json`.
Setting it to `false` disables the feature, and `true` enables it.
Setting it to a function maps the final `source.json` value - returning `null` disables it.

The `.well-known/source.json` file contains more details about
the `package.json`'s `exports`, like exported declaration names and types.
It maps each export to a source file in `.well-known/src/`.

## `well_known_src_files`

The contents of your `src/` directory can be included in the output
if you want your app's source code to be available the same as the built files.
This is disabled by default.
If `well_known_src_files` is truthy,
the plugin copies `src/` to `static/.well-known/src/` during `vite build`.
Passing `true` uses the same filter as `exports` in `package.json` by default,
and it also accepts a custom filter function.
