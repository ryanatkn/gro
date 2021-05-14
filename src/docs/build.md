# build

This document describes how to go from `gro build` to live websites and npm packages.

Gro has an [unbundled build system](unbundled.md)
that tries to be flexible for many use cases.
It produces artifacts to `.gro/prob/{build_name}`
that get _adapted_ — to use terminology of SvelteKit —
to the target platforms.

"Target platforms" for Gro includes publishing to npm,
but Gro has a very clear distinction between **deploy** and **publish**:
`gro publish` is for npm and `gro deploy` is for the web.

## adapters

Gro has `Adapter`s inspired by Svelte.
When we run:

```bash
gro build
```

The build process has discrete steps:

1. [`Builder`](../build/builder.ts)s run and output production artifacts to `.gro/prod/{buildName}` for each build
2. [`Adapter`](../adapt/adapter.ts)s run and output, umm, anything?
   like SvelteKit frontends, Node libraries, API servers, & more !

> as we're thinking about them, `Adapter`s should not modify the contents of `.gro/prod/`;
> they take builds as inputs, and without changing them,
> they output whatever you want for as long as you want as messily as you want,
> just no messing with the source, that is forbidden --
> this design lets you run many adapters on one build,
> which means composability & power & efficiency;
> if you find yourself wanting to modify builds in place, try a `Builder` instead
> (the API probably needs improvements and helpers) open issues if you want to discuss!

An adapter is a small plugin with a few optional hooks:

```ts
export interface Adapter<TArgs = any, TEvents = any> {
	name: string;
	begin?: (ctx: AdaptBuildsContext<TArgs, TEvents>) => void | Promise<void>;
	adapt?: (ctx: AdaptBuildsContext<TArgs, TEvents>) => void | Promise<void>;
	end?: (ctx: AdaptBuildsContext<TArgs, TEvents>) => void | Promise<void>;
}
```

The `AdaptBuildsContext` extends
[Gro's `TaskContext`](../task/README.md#user-content-types-task-and-taskcontext)
with additional properties,
so adapter functions have full access to
[the normal task environment](../task/README.md).

Gro has a number of builtin adapters. Some are a work in progress:

- [x] [`gro-adapter-node-library`](../adapt/gro-adapter-node-library.ts)
- [ ] [`gro-adapter-api-server`](../adapt/gro-adapter-api-server)
- [ ] [`gro-adapter-spa-frontend`](../adapt/gro-adapter-spa-frontend)
- [ ] [`gro-adapter-sveltekit-frontend `](../adapt/gro-adapter-sveltekit-frontend)
