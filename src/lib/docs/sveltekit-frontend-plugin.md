# SvelteKit frontend plugin

Gro's [SvelteKit frontend plugin](/src/lib/gro_plugin_sveltekit_frontend.ts)
calls `vite dev` and `vite build` with some additional behaviors.

```ts
// gro.config.ts
import type {GroConfigCreator} from '@grogarden/gro';

const config: GroConfigCreator = async (cfg) => {
	cfg.plugins = async () => [
		// this is included in the default config for SvelteKit projects:
		(await import('@grogarden/gro/gro_plugin_sveltekit_frontend.js')).plugin({
			// host_target?: HostTarget;
			// well_known_package_json?: boolean | MapPackageJson;
		}),
	];
	return cfg;
};

export default config;
```

## `host_target`

When `host_target` is the default value `'github_pages'`,
a `.nojekyll` file is included in the build to tell GitHub Pages not to process it with Jekyll.

## `well_known_package_json`

By default Gro copies your root `package.json`
to the SvelteKit build output directory in `.well-known/package.json`
unless `package.json` has `"private": true`.
The motivation is to provide conventional package metadata to web users and tools.

> Currently, Gro writes the file directly after building,
> but we may want to change it to temporarily create the file before building
> in the repo's `static/` directory so Vite plugins can see it.

By default it copies the root `package.json` without modifications,
and you can provide your own `map_package_json` hook to
mutate the `pkg`, return new data, or return `null` to be a no-op.

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

> ⚠️ Outputting `.well-known/package.json` will surprise some users
> and could result in information leaks that compromise privacy or security.
> Gro's defaults are designed for open source projects,
> but configuring closed private projects should remain simple.
> To migitate these issues:
>
> - all `package.json` automations are disabled when `"private": true`
>   (templates should default to private to avoid accidental npm publishing as well)
> - the `package.json` is written to `.well-known` during development
>   and it's expected to be committed to source control, giving the feature explicit visibility
>   and requiring developers to either opt into adding the file with git
>   or opt out of generating it -
>   the alternative of outputting it to the SvelteKit build may appear cleaner,
>   but Gro's position is that this opinionated workflow is in everyone's best interest
