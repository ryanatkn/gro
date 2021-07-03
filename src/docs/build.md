# build

This document describes how to go from `gro build` to live websites and npm packages.

> this is for production builds; for development, see [dev.md](dev.md)

Gro has an [unbundled build system](dev.md)
that tries to be flexible for many use cases.
During development, we use it with `gro dev`.

For production, we use `gro build` to output builds to `.gro/prod/{build_name}`,
which then get _adapted_ — to use terminology of SvelteKit — to their final form.
Adapting can be as simple as copying
the directory of files in `.gro/prod/{build_name}` to `dist/`,
or it may be more complex, like a SvelteKit build,
or a Node library bundled into sibling `.js` and `.cjs` outputs.
Adapting is designed to be powerful and open ended.

## contents

- [plugin](#plugin)
- [adapt](#adapt)
- [deploying and publishing](#deploying-and-publishing)

## plugin

`Plugin`s are objects that customize the behavior of `gro build` (and `gro dev`).
See [plugin.md](plugin.md) to learn more.

## adapt

`Adapter`s are objects that output final build artifacts from production builds during `gro build`.
See [adapt.md](adapt.md) to learn more.

## deploying and publishing

Now that we can make builds and then adapt them, how do we, like, make them go?
You know, to the web or whatever?

The [`gro deploy`](deploy.md) task helps you output builds to a branch,
like for static publishing to GitHub pages. (TODO needs work)

The [`gro publish`](publish.md) task publishes packages to npm.

Both of these tasks call `gro build` internally
but you can always run it manually if you're curious.
