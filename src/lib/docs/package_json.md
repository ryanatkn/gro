# `package.json`

Gro extends [`package.json`](https://docs.npmjs.com/cli/v10/configuring-npm/package-json)
with additional functionality.

## `public` packages

Setting `"public": true` in `package.json` opts into
behavior designed for public open source projects:

- copies `package.json` from your project root to your
  SvelteKit static directory at `.well-known/package.json` during `vite build`,
  mapping it with the optional `well_known_package_json` option
- `gro_plugin_sveltekit_frontend` outputs `.well-known/src.json`
  using the `exports` property of `package.json` during `vite build`,
  containing additional information about the source modules,
  mapping it with the optional `well_known_src_json` option
- `gro_plugin_sveltekit_frontend` outputs `.well-known/src/` by
  copying over `src/` filtered by `filter_well_known_src` during `vite build`
  (costly but seems worth exploring, renews "View source" as an option among other things)

> ⚠️ Setting `"public": true` in `package.json` exposes your source code at your deployed endpoint!
> If that's the public web, that means your source code is public.
