# SvelteKit frontend plugin

Gro's [SvelteKit frontend plugin](/src/lib/gro_plugin_sveltekit_frontend.ts)
calls `vite dev` and `vite build` with some additional behaviors.

```ts
// gro.config.ts
import type {Gro_ConfigCreator} from '@grogarden/gro';

const config: Gro_ConfigCreator = async (cfg) => {
	cfg.plugins = async () => [
		// this is included in the default config for SvelteKit projects:
		(await import('@grogarden/gro/gro_plugin_sveltekit_frontend.js')).plugin({
			// host_target?: Host_Target;
			// well_known_package_json?: boolean | Map_Package_Json;
			// well_known_src_json?: boolean | Map_Src_Json;
			// filter_well_known_src?: (source: string, destination: string) => boolean | Promise<boolean>;
		}),
	];
	return cfg;
};

export default config;

// src/lib/gro_plugin_sveltekit_frontend.ts
export type Host_Target = 'github_pages' | 'static' | 'node';

export interface Map_Package_Json {
	(package_json: Package_Json): Package_Json | null | Promise<Package_Json | null>;
}
```

## `host_target`

When `host_target` is the default value `'github_pages'`,
a `.nojekyll` file is included in the build to tell GitHub Pages not to process it with Jekyll.

## `well_known_package_json`

If your root `package.json` has `"public": true`,
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

## `well_known_src_json`

If your root `package.json` has `"public": true`,
by default Gro creates `.well-known/src.json` and `.well-known/src/`
in `static/` during `vite build`,
so they're included in the SvelteKit build output.

This can be customized with `well_known_src_json`.
Setting it to `false` disables the feature,
and `true` uses the default mapping function,
which is the same default matching behavior
that includes modules for `exports` in `package.json`.
You can also provide a custom mapping function.

The `.well-known/src.json` file contains more details about
the `package.json`'s `exports`, like exported identifier names and types.
It maps each export to a source file in `.well-known/src/`.

The contents of your `src/` directory are copied to `.well-known/src/`
using the same filter as `exports` in `package.json` by default,
and this can be customized with `filter_well_known_src`.
