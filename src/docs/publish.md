# publish

Here's how to publish a new version of Gro.

## login to npm

```bash
npm whoami # check if you're logged in

# not logged in?
npm login # and follow the instructions
```

> see also [`npm adduser`](https://docs.npmjs.com/cli/v6/commands/npm-adduser)

## make sure everything looks good

Until Gro smooths out its `npm` process,
it's probably a good idea to make sure your project builds before we proceed:

```bash
gro build
```

## bump the version and tag the commit

To publish a new version of Gro,
first [bump the version with `npm version`](https://docs.npmjs.com/cli/v6/commands/npm-version).
The npm script `"preversion"` will make sure
everything typechecks and all tests pass.
This creates a new commit with the version tag,
which is then used by both
[npm](https://www.npmjs.com/package/@feltcoop/gro?activeTab=versions) and
[GitHub's releases](https://github.com/feltcoop/gro/releases).

```bash
npm version <major|minor|patch>
```

## publish to npm

Then publish the new version.

```bash
npm publish
```

And finally push the tagged commit to sync on GitHub.

```bash
git push --tags
git push
```

## prefer `gro version`

Gro offers a `gro version` task that passes through its args directly to
[`npm version`](https://docs.npmjs.com/cli/v6/commands/npm-version).
It builds, bumps the version, publishes to npm, and syncs commits and tags to GitHub.
When stable, it will properly roll back if something goes wrong at any step.
Currently it's not stable. You may need to `git reset --hard` version commits if things go wrong.

> note: if `npm publish` fails during `gro version`, nothing else should be affected;
> continue manually with `npm publish` (usually fails because you need to `npm adduser`)
