# vite_plugin_well_known

A Vite plugin that publishes `package.json` and source metadata
to `.well-known/` in your build output, available in both dev and production.

## Usage

```ts
// vite.config.ts
import {sveltekit} from '@sveltejs/kit/vite';
import {vite_plugin_well_known} from '@ryanatkn/gro';

export default {
	plugins: [sveltekit(), vite_plugin_well_known()],
};
```

## Options

```ts
vite_plugin_well_known({
	package_json: true, // boolean or mapper function
	source_json: true, // boolean or mapper function
	src_files: false, // boolean or filter function
});
```

All options default to `true` except `src_files` which defaults to `false`.

### `package_json`

Outputs `.well-known/package.json` from your project root.
Pass a function to transform the output:

```ts
vite_plugin_well_known({
	package_json: (pkg) => ({...pkg, version: '0.0.0'}),
});
```

Return `null` to disable.

### `source_json`

Outputs `.well-known/source.json` containing metadata about source modules
based on the `exports` field in `package.json`,
including exported declaration names and types.

Pass a function to transform the output, or `null` to disable.

### `src_files`

Copies `src/` to `.well-known/src/` so your source code is available
alongside the built files. Disabled by default.

```ts
vite_plugin_well_known({src_files: true});
```

Pass a filter function to control which files are copied:

```ts
vite_plugin_well_known({
	src_files: (path) => !path.endsWith('.test.ts'),
});
```

This is costly (usually more than doubling the final output size),
slows the build, and exposes your source code.

## Why `.well-known`?

Writing to `.well-known/package.json` extends
[Well-known URIs](https://wikipedia.org/wiki/Well-known_URIs) for Node packages
to provide conventional metadata for deployed websites.
[Mastodon](<https://en.wikipedia.org/wiki/Mastodon_(social_network)>) uses
[WebFinger](https://en.wikipedia.org/wiki/WebFinger) which uses `.well-known` for discovery.

SvelteKit outputs static files relative to the configured `base` path,
so the `.well-known` directory may not be in the root `/`.
This enables websites to provide metadata even when hosted in a namespaced
path like `username.github.io/projectname/.well-known`.

Why publish this metadata to the web instead of relying on the git repo?

- give all web users and tools access to discoverable package metadata
- metadata is a much lighter dependency than an entire repo
- some repos are deployed to multiple websites with metadata differences
- some repos like monorepos have multiple `package.json` files
- no dependency on git or the bespoke URLs of forge hosts like GitHub
- the git repo is still the source of truth, but the build step gives
  devs full control over the published artifacts
