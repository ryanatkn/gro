# publish

Here's how to publish a new version of Gro.

## login to npm

If you're not already logged into npm in your terminal:

```bash
npm login # and follow the instructions
```

## publish to npm

To publish a new version of Gro,
first bump the version.
Tests will first run via the `"preversion"` npm script.

```bash
npm version <major|minor|patch>
```

Then publish the new version.
Because Gro is a scoped package, `@feltcoop/gro`,
we need to specify that it's public not private.

```bash
npm publish --access public
```
