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

## `gro publish`

Gro offers a `gro publish` task that passes through its args directly to
[`npm version`](https://docs.npmjs.com/cli/v6/commands/npm-version).
It builds, bumps the version, publishes to npm, and syncs commits and tags to GitHub.
When stable, it will properly roll back if something goes wrong at any step.
Currently it's not stable. You may need to `git reset --hard` version commits if things go wrong.

> note: if `npm publish` fails during `gro publish`, nothing else should be affected;
> continue manually with `npm publish` (usually fails because you need to `npm adduser`)
