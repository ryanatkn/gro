# build

> these docs are for production builds, for development see [dev.md](dev.md)

## usage

The `gro build` task produces outputs for production:

```bash
gro build
```

This runs the configured Gro plugins, `setup -> adapt -> teardown`, in production mode.

If your project has a SvelteKit frontend,
[the default plugin](../lib/gro_plugin_sveltekit_app.ts) calls `vite build`,
forwarding any [`-- vite [...]` args](https://vitejs.dev/config/):

```bash
gro build -- vite --config my-config.js
```

## build caching

Gro automatically caches builds to skip expensive rebuilds when nothing has changed.
The cache is **enabled by default** and validates these factors:

- Git commit hash (your source code)
- Lock file hash (your dependencies: `package-lock.json`, `pnpm-lock.yaml`, or `yarn.lock`)
- Config file hashes (build configuration: `svelte.config.js`, `gro.config.ts`, `vite.config.ts`)
- Build args (task arguments like `--sync`, `--install`)
- Custom `build_cache_config` from your `gro.config.ts` (see [config.md](config.md))

If all factors match and build outputs are validated, the build is skipped:

```bash
gro build
# Build cache valid (from 2025-10-21T10:30:00.000Z) (use --force_build to rebuild)
# Skipping build, cache is valid
```

To force a fresh build, ignoring the cache:

```bash
gro build --force_build
```

### cache storage

Build cache metadata is stored at `build/.build-meta.json` alongside your build outputs.
When you run `gro clean`, the cache is deleted along with the build directory.

### custom cache invalidation

If your build depends on external factors (environment variables, data files, feature flags),
use `build_cache_config` in `gro.config.ts` to invalidate the cache when they change:

```typescript
// gro.config.ts
export default {
	build_cache_config: {
		api_endpoint: process.env.PUBLIC_API_URL,
		data_version: fs.readFileSync('data/version.txt', 'utf-8'),
		features: {analytics: true, beta_ui: false},
	},
} satisfies Gro_Config;
```

The config is hashed (never logged) to protect sensitive values. Any change triggers a rebuild.

See [config.md](config.md) for more details on `build_cache_config`.

## plugins

`Plugin`s are objects that customize the behavior of `gro build` and `gro dev`.
They try to defer to underlying tools as much as possible, and exist to glue everything together.
For example, the library plugin internally uses
[`svelte-package`](https://kit.svelte.dev/docs/packaging).
See [plugin.md](plugin.md) to learn more.

## deploying and publishing

Now that we can produce builds, how do we share them with the world?

The [`gro deploy`](deploy.md) task outputs builds to a branch,
like for static publishing to GitHub pages.

The [`gro publish`](publish.md) task publishes packages to npm.

Both of these tasks call `gro build` internally,
and you can always run it manually if you're curious.
