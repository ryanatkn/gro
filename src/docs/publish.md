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

```bash
gro publish
gro publish --help # view the options
```

If `changeset publish` fails during `gro publish`,
the task exits without pushing anything to the remote origin.
It does however create the version commit and tag.
A common failure is not being logged into npm. (see the instructions above)
If the builds are correct but `changeset publish` failed,
and you don't want to undo the version commit and tag,
you can continue manually with `changeset publish` or `npm publish` in `/dist/library`.
