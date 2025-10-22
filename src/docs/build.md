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

Gro caches builds to skip expensive rebuilds when nothing has changed.

The cache key has two components:

- git commit hash - tracks code, dependencies, and config files
- `build_cache_config` hash - optional, for tracking external inputs like environment variables or feature flags
  (see [config.md](config.md#build_cache_config))

The cache invalidates when either component changes.

When the cache is valid:

```bash
gro build
# Build cache valid (from 2025-10-21T10:30:00.000Z) (use --force_build to rebuild)
# Skipping build, cache is valid
```

Force a rebuild:

```bash
gro build --force_build
```

### cache storage

Cache metadata is stored at `.gro/build.json`.
This location is independent of build outputs, so the cache survives manual deletion of `build/`.
Running `gro clean` deletes the cache along with the `.gro/` directory.

### dirty workspace behavior

The build cache only works with a clean git workspace.
With uncommitted changes, the git commit hash doesn't reflect your actual code state,
so Gro disables caching to ensure builds always match your working directory.

This conservative approach prevents a subtle issue:
uncommitted changes could be reverted after building,
leaving cached outputs from code that no longer exists in your workspace.

Behavior with uncommitted changes:

- cache checking is skipped - builds always run
- cache is not saved - no `.gro/build.json` written
- all build outputs are deleted - `build/`, `dist/`, and `dist_*/` removed to prevent stale state
- you'll see: `Workspace has uncommitted changes - skipping build cache`

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

### cache validation

Beyond checking the cache key, Gro validates that cached output files haven't been tampered with or corrupted.
All output files are hashed in parallel to verify integrity.
This is a robustness design choice - even if the cache key matches,
corrupted or manually modified files trigger a rebuild.

The hashing is usually fast but adds overhead proportional to output size.

Force a rebuild without validation:

```bash
gro build --force_build
```

> TODO what opportunities are there to leverage the build metadata?

### race condition protection

After a successful build, Gro verifies the git commit hash hasn't changed before saving the cache.
If the commit changed during the build (e.g., you committed while building),
the cache is not saved and you'll see a warning.
This ensures cache metadata always matches its corresponding build outputs.

### best practices

For reliable caching:

- commit before building for production - cache requires a clean workspace
- use `build_cache_config` for external inputs - environment variables,
  remote configs, or feature flags that affect the build but aren't in git
- use `gro check --workspace` in CI - enforces clean git state before building

During development, uncommitted changes automatically disable caching,
so builds always reflect your working directory.

### CI/CD integration

> Don't commit `.gro/build.json` - keep it in `.gitignore`.

Caching `.gro/` between CI runs is usually not beneficial since each commit invalidates the cache.

Basic CI workflow:

```bash
gro check --workspace  # ensure clean workspace
gro build              # build (uses cache if valid)
```

To investigate cache issues, use `LOG_LEVEL=debug gro build` or `gro build --force_build`.

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
