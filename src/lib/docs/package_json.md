# `package.json`

Gro extends [`package.json`](https://docs.npmjs.com/cli/v10/configuring-npm/package-json)
with additional functionality.

## `public` packages

Setting `"public": true` in `package.json` opts into
behavior designed for public open source projects:

- [`gro_plugin_sveltekit_frontend`](./gro_plugin_sveltekit_frontend.md)
  copies `package.json` from your project root to your
  SvelteKit static directory at `.well-known/package.json` during `vite build`,
  mapping it with the optional
  [`well_known_package_json` option](./gro_plugin_sveltekit_frontend.md#well_known_package_json)
- `gro_plugin_sveltekit_frontend` outputs `.well-known/src.json`
  using the `exports` property of `package.json` during `vite build`,
  containing additional information about the source modules,
  mapping it with the optional
  [`well_known_src_json` option](./gro_plugin_sveltekit_frontend.md#well_known_src_json)
- `gro_plugin_sveltekit_frontend` outputs `.well-known/src/` by
  copying over `src/` filtered by `filter_well_known_src` during `vite build` -
  this is costly (usually more than doubling the final output size
  of the code files in bytes, not counting images and such),
  and it slows the build because it copies your entire source tree (sorry to hard drives),
  but the UX is not affected

> ⚠️ Setting `"public": true` in `package.json` exposes your source code at your deployed endpoint!
> If that's the public web, that means your source code is public.
