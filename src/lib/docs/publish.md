# publish

Here's how to publish a new version of a repo with Gro, including for Gro itself.

## login to npm

```bash
npm whoami # check if you're logged in

# not logged in?
npm login # and follow the instructions
```

> more about [`npm login`](https://docs.npmjs.com/cli/v6/commands/npm-adduser)

## using changesets

The [`gro publish` task](https://github.com/grogarden/gro/blob/main/src/lib/publish.task.ts)
integrates with [Changesets](https://github.com/changesets/changesets)
to publish packages to [npm](https://npmjs.com/). Internally the task calls both
[`changeset version`](https://github.com/changesets/changesets/blob/main/packages/cli/README.md#version)
and
[`changeset publish`](https://github.com/changesets/changesets/blob/main/packages/cli/README.md#publish).

Gro does not include Changesets as a dependency.
Install it globally or local to your repo:

```bash
npm i -g @changesets/cli # install globally
npm i -D @changesets/cli # or install local to your repo
```

To set up a repo, first run
[init](https://github.com/changesets/changesets/blob/main/packages/cli/README.md#init):

```bash
changeset init
npx changeset init # if installed only locally
```

Optionally configure and install a custom changelog package
in the `"changelog"` property of the newly created `.changeset/config.json`:

```diff
# .changeset/config.json
- "changelog": "@changesets/cli/changelog",
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

To [add](https://github.com/changesets/changesets/blob/main/packages/cli/README.md#add) a changeset:

```bash
changeset
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

## `gro exports`

[The exports task](/src/lib/exports.task.ts) is a convenience
for declaring the modules of `lib/` in your `package.json` `"exports"`.

Currently, `gro exports` is a manual step
and it accepts a `--check` flag to throw if anything changed.
The plan is to make exports configurable in `gro.config.ts`,
and then it'll be automated and included as a default to `gro check`.

Gro won't try to automate exports without a better config story (CLI args are not enough)
because exporting all of `lib/` to users is not a recommended practice.
For now, it's helpful to run the task and then update things by hand as needed before committing.
