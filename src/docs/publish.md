# publish

Here's how to publish a new version of Gro.

## login to npm

If you're not already logged into npm in your terminal:

```bash
npm login # and follow the instructions
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
