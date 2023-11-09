# `package.json`

Gro extends [`package.json`](https://docs.npmjs.com/cli/v10/configuring-npm/package-json)
with additional functionality:

## `"public": true`

The `"public"` property can be set to `true` to opt into behavior designed for open source projects:

- `gro_plugin_sveltekit_frontend` copies `package.json` from your project root to your
  SvelteKit build output directory (`/build` by default),
  mapping it with the optional `well_known_package_json` option
