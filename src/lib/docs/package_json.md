# `package.json`

Gro extends [`package.json`](https://docs.npmjs.com/cli/v10/configuring-npm/package-json)
with additional functionality.

## `public` packages

Setting `"public": true` in `package.json` opts into
behavior designed for public open source projects:

- [`gro_plugin_sveltekit_app`](./gro_plugin_sveltekit_app.md)
  copies `package.json` from your project root to your
  SvelteKit static directory at `.well-known/package.json` during `vite build`,
  mapping it with the optional
  [`well_known_package_json` option](./gro_plugin_sveltekit_app.md#well_known_package_json).
- `gro_plugin_sveltekit_app` outputs `.well-known/src.json`
  using the `exports` property of `package.json` during `vite build`,
  containing additional information about the source modules,
  mapping it with the optional
  [`well_known_src_json` option](./gro_plugin_sveltekit_app.md#well_known_src_json).
- If you define a truthy value for the
  [`well_known_src_files` option](./gro_plugin_sveltekit_app.md#well_known_src_files),
  `gro_plugin_sveltekit_app` outputs `.well-known/src/` by
  copying over `src/` during `vite build`, filtered by `well_known_src_files` if it's a function.
  This is costly (usually more than doubling the final output size
  of the code files in bytes, not counting images and such),
  it slows the build because it copies your entire source tree (sorry to hard drives),
  and it exposes your source code the same as the built files.

> ⚠️ Setting `"public": true` in `package.json` exposes your `package.json`
> and `src.json` metadata with your other built files by default!
> Further opting in with `well_known_src_files` exposes your actual source files.
> If your built files are public, that means these additional files are also public.
