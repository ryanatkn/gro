# build

> these docs are for production builds, for development see [dev.md](dev.md)

## usage

The `gro build` task produces outputs for production:

```bash
gro build
```

Internally, it calls `vite build` and runs the configured Gro plugins.

## plugins

`Plugin`s are objects that customize the behavior of `gro build` and `gro dev`.
They try to defer to underlying tools as much as possible, and exist to glue everything together.
For example, the library plugin internally uses
[`svelte-package`](https://kit.svelte.dev/docs/packaging).
See [plugin.md](plugin.md) to learn more.

## deploying and publishing

Now that we can produce builds, how do we share them with the world?

The [`gro deploy`](deploy.md) task outputs builds to a branch,
like for static publishing to GitHub pages.

The [`gro publish`](publish.md) task publishes packages to npm.

Both of these tasks call `gro build` internally,
and you can always run it manually if you're curious.
