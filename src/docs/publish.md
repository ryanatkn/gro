# publish

Here's how to publish a new version of Gro.

## login to npm

If you're not already logged into npm in your terminal:

```bash
npm whoami # check if you're logged in

# not logged in?
npm login # and follow the instructions
```

## make sure everything looks good

Until Gro smooths out its `npm` process,
it's probably a good idea to make sure your project builds before we proceed:

```bash
gro build
```

## bump the version and tag the commit

To publish a new version of Gro,
first bump the version.
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
git push origin --tags
```

## prefer `gro version`

Gro offers a `gro version` task that passes through its args directly to `npm version`.
It bumps the version, publishes to npm, and syncs commits and tags to GitHub.
When stable, it will properly roll back if something goes wrong at any step.
Currently it's not stable. You may need to `git reset --hard` version commits if things go wrong.
