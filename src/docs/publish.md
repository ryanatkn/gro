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

The [`gro publish` task](https://github.com/feltjs/gro/blob/main/src/publish.task.ts)
integrates with [Changesets](https://github.com/changesets/changesets)
to publish a project to [npm](https://npmjs.com/). The task calls both
[`changeset version`](https://github.com/changesets/changesets/blob/main/packages/cli/README.md#version)
and
[`changeset publish`](https://github.com/changesets/changesets/blob/main/packages/cli/README.md#publish).

Gro does not include Changesets as a dependency.
Install it globally or local to your project:

```bash
npm i -g @changesets/cli
```

To set Changesets up in a project, first run
[init](https://github.com/changesets/changesets/blob/main/packages/cli/README.md#init):

```bash
changeset init
```

If your package is public, be sure to set its access to "public":

```diff
# .changeset/config.json
- "access": "restricted",
+ "access": "public",
```

Optionally install a custom changelog generator like
[@svitejs/changesets-changelog-github-compact](https://github.com/svitejs/changesets-changelog-github-compact):

```bash
npm i -D @svitejs/changesets-changelog-github-compact
```

```diff
# .changeset/config.json
- "changelog": "@changesets/cli/changelog",
+ "changelog": ["@svitejs/changesets-changelog-github-compact", {"repo": "org/repo"}],
```

To [add](https://github.com/changesets/changesets/blob/main/packages/cli/README.md#add) a changeset:

```bash
changeset
```

See [the Changesets docs](https://github.com/changesets/changesets) for more.

## `gro publish`

The publish task builds, updates the version, publishes to npm,
and syncs commits and tags to GitHub.

```bash
gro publish
gro publish --help # view the options
```

If `changeset publish` fails during `gro publish`, nothing else should be affected.
A common failure is not being logged into npm. (see the instructions above)
If the builds are correct but `changeset publish` failed,
and you don't want to undo the version commit and tag,
you can continue manually with `changeset publish` or `npm publish` in `/dist`.
