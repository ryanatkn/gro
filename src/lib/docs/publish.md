# publish

Here's how to publish a new version of a repo with Gro, including for Gro itself.

## svelte-package

Gro uses SvelteKit's [`@sveltejs/package`](https://kit.svelte.dev/docs/packaging)
with the task `gro publish` to publish packages to npm.
Gro's default config enables [`@grogarden/gro/gro_plugin_library.js`](../gro_plugin_library.ts)
if it detects `@sveltejs/package` installed as a dependency in the package.json.

```bash
# enable `gro publish` to publish to npm:
npm i -D @sveltejs/package # enables `@grogarden/gro/gro_plugin_library.js`
gro sync # updates package.json "exports"
git commit -am "..."
# `gro publish` calls `svelte-package`
```

## login to npm

```bash
npm whoami # check if you're logged in

# not logged in?
npm login # and follow the instructions
```

> more about [`npm login`](https://docs.npmjs.com/v6/commands/npm-adduser)

## using changesets

The [`gro publish` task](https://github.com/grogarden/gro/blob/main/src/lib/publish.task.ts)
integrates with [Changesets](https://github.com/changesets/changesets)
to publish packages to [npm](https://npmjs.com/). Internally the task calls both
[`changeset version`](https://github.com/changesets/changesets/blob/main/packages/README.md#version)
and
[`changeset publish`](https://github.com/changesets/changesets/blob/main/packages/README.md#publish).

Gro does not include Changesets as a dependency.
Install it globally or local to your repo
(I prefer global, it's not a light dependency):

```bash
npm i -g @changesets/cli # install globally
npm i -D @changesets/cli # or install local to your repo
```

To [init Changesets](https://github.com/changesets/changesets/blob/main/packages/README.md#init)
in a repo or [add](https://github.com/changesets/changesets/blob/main/packages/README.md#add)
a changeset to an already-inited repo, use `gro changeset`:

```bash
gro changeset # inits or adds a changeset
gro changeset --help # prints:
gro changeset: call changeset with gro patterns

[...args]   string[]                 []                           the commands to pass to changeset
path        string                   './.changeset/config.json'   changeset config file path
access      'restricted' | 'public'  undefined                    changeset 'access' config value, the default depends on package.json#private
changelog   string                   '@changesets/changelog-git'  changeset "changelog" config value
no-install  boolean                  false                        opt out of npm installing the changelog package

# `gro changeset` is equivalent to:
changeset init # if needed -- prefix with `npx ` if installed only locally
changeset
git add .changeset/$FILE
# TODO include a `git commit` flag or default behavior, maybe `gro changeset "message"`
```

After initing, optionally configure and install a custom changelog package
in the `"changelog"` property of the newly created `.changeset/config.json`:

```diff
# .changeset/config.json
- "changelog": "@changesets/changelog",
+ "changelog": "@changesets/changelog-git",
```

```bash
npm i -D @changesets/changelog-git  # a minimal package that requires no GitHub auth
```

If your package is public, configure the `access` property:

```diff
# .changeset/config.json
- "access": "restricted",
+ "access": "public",
```

See [the Changesets docs](https://github.com/changesets/changesets) for more.

## `gro publish`

The publish task builds the project, bumps the version, publishes to npm,
commits the changes, and then pushes the commit and tag.

First add `"dist"` to the `"files"` property of `package.json`:

```json
"files": [
  "dist"
],
```

Then publish:

```bash
gro publish
gro publish --help # view the options
gro publish -- svelte-package -w # forward options
```

See [the SvelteKit packaging docs](https://kit.svelte.dev/docs/packaging) for more.

If `changeset publish` fails during `gro publish`,
the task exits without pushing anything to the remote origin.
It does however create the version commit and tag.
A common failure is not being logged into npm. (see the instructions above)
If the builds are correct but `changeset publish` failed,
and you don't want to undo the version commit and tag,
you can continue manually with `changeset publish` or `npm publish`.

## `config.package_json`

```ts
export interface GroConfig {
	// ...

	/**
	 * Maps the project's `package.json` before writing it to the filesystem.
	 * The `pkg` argument may be mutated, but the return value is what's used by the caller.
	 * Returning `null` is a no-op for the caller.
	 */
	package_json: MapPackageJson | null;
}
```
