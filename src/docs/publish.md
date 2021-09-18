# publish

Here's how to publish a new version of Gro.

## login to npm

```bash
npm whoami # check if you're logged in

# not logged in?
npm login # and follow the instructions
```

> see also [`npm adduser`](https://docs.npmjs.com/cli/v6/commands/npm-adduser)

## `gro publish`

Gro offers the `gro publish` task to push a project to a package registry;
currently only npm is supported.
The task passes its args through to
[`npm version`](https://docs.npmjs.com/cli/v6/commands/npm-version),
so to bump the minor version run `gro publish minor`.
It builds, bumps the version, publishes to npm, and syncs commits and tags to GitHub.

Projects are expected to conform to particular changelog format.
See [changelog.md](/changelog.md) for an example.
The `gro publish` task should explain what's wrong and offer an override.

If `npm publish` fails during `gro publish`, nothing else should be affected;
a common reason is not being logged into npm. (`npm adduser`)
If the builds are correct but `npm publish` failed,
and you don't want to undo the version commit and tag,
you can continue manually with `npm publish` inside
the `/dist` subdirectories.
