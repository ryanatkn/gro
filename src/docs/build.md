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
The cache is **enabled by default** and uses your **git commit hash** as the primary cache key.

The cache invalidates when:

- git commit changes: any change to source code, dependencies (when committed), or config files
- custom `build_cache_config` changes (optional):
  external inputs like environment variables or feature flags
  (see [config.md](config.md#build_cache_config))

When the cache is valid, the build is skipped:

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

Build cache metadata is stored at `.gro/build.json` in Gro's internal directory.
This location is independent of your build outputs, so the cache survives manual deletion of `build/`.
When you run `gro clean`, the cache is deleted along with the `.gro/` directory.

### dirty workspace behavior

**The build cache only works with a clean git workspace.** If you have uncommitted changes:

- Cache checking is **skipped** - builds always run with uncommitted changes
- Cache **won't be saved** - no `.gro/build.json` is written after the build
- Distribution outputs **deleted** - `dist/` and `dist_*/` directories are removed to prevent stale state
- You'll see: `Workspace has uncommitted changes - skipping build cache`

This ensures builds always reflect your working directory changes during development.

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

See [config.md](config.md#build_cache_config) for more details on `build_cache_config`.

### performance

Build cache validation hashes all output files to detect tampering.
Hashing runs in parallel and is usually fast but does add overhead.

To skip validation: `gro build --force_build`

> TODO what opportunities are there to leverage the build metadata?

### best practices

For reliable caching:

- commit before building: the cache only works with a clean workspace,
  so commit all changes before building for production
- use `build_cache_config` for external inputs: environment variables,
  remote configs, or feature flags that affect the build but aren't in git
- CI workflow: use `gro check --workspace` to enforce clean git state before building

For development, uncommitted changes automatically disable caching,
so builds always reflect your working directory.
This prevents stale caches during development
while still providing caching benefits in CI and production.

### CI/CD integration

**Don't commit `.gro/build.json`** - Keep it in `.gitignore`.

**Caching `.gro/` between CI runs** is usually not beneficial
since each commit invalidates the cache.

**Basic CI workflow:**

```bash
gro check --workspace  # Ensure clean workspace
gro build              # Build (uses cache if valid)
```

**Debugging:** Use `LOG_LEVEL=debug gro build`
or `gro build --force_build` to investigate cache issues.

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
