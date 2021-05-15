# build

This document describes how to go from `gro build` to live websites and npm packages.

Gro has an [unbundled build system](unbundled.md)
that tries to be flexible for many use cases.
For production builds, it outputs artifacts to `.gro/prod/{build_name}`
that get _adapted_ — to use terminology of SvelteKit — to their final form.
Adapting can be as simple as copying
the directory of files in `.gro/prod/{build_name}` to `dist/`,
or it may be more complex, like a SvelteKit build,
or a Node library bundled into sibling `.js` and `.cjs` outputs.
Adapting is designed to be powerful and open ended.

## adapters

Gro borrows the `Adapter` concept from SvelteKit to help us control our builds.
When we run:

```bash
gro build
```

the build process has two discrete steps:

1. [`Builder`](../build/builder.ts)s run and output production artifacts to `.gro/prod/{buildName}` for each build
2. [`Adapter`](../adapt/adapter.ts)s run and output, umm, anything?
   like SvelteKit frontends, Node libraries, API servers, & more !

> as we're thinking about them, `Adapter`s should not modify the contents of `.gro/prod/`;
> adapters take these builds as inputs, and without changing them,
> they output whatever you want, for as long as you want, as messily as you want;
> just no messing with the source, that is forbidden --
> this design lets you run many adapters on one build,
> which means composability & power & efficiency;
> if you find yourself wanting to modify builds in place, try a `Builder` instead
> (the API probably needs improvements and helpers) -- open issues if you want to discuss!

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
- [ ] [`gro-adapter-api-server`](../adapt/gro-adapter-api-server.ts)
- [ ] [`gro-adapter-spa-frontend`](../adapt/gro-adapter-spa-frontend.ts)
- [ ] [`gro-adapter-sveltekit-frontend `](../adapt/gro-adapter-sveltekit-frontend.ts)

## adapt

[Gro configs](config.md) have an `adapt` property to configure a project's `Adapter` usage.

To learn how to use adapters and other build options, see [the config docs](config.md).

You may notice that the Gro config `adapt` property is a function that returns `Adapter` instances,
and you may be dismayed that it's not as simple as SvelteKit's API,
which has an `adapter` property that accepts `Adapter` instances.
In Gro, there's the `adapt` function property,
a necessary wrapper function that returns `Adapter` instances:

```ts
import type {GroConfigCreator} from '@feltcoop/gro/dist/config/config.js';

export const config: GroConfigCreator = async () => {
	return {
		adapt: async () => [
			(await import('@feltcoop/gro/gro-adapter-sveltekit-frontend.js')).createAdapter(),
			(await import('@feltcoop/gro/gro-adapter-node-library.js')).createAdapter(),
			(await import('@feltcoop/gro/gro-adapter-api-server.js')).createAdapter(),
		],

		// this does not work, even though it's simpler!
		adapt: {name: 'my-adapter', adapt: () => {}},

		// this does work (note it does not have to import anything, or be async):
		adapt: () => {
			return {name: 'my-adapter', adapt: () => {}};
		},

		// both `adapt` and the `Adapter` hooks get access to an extended task context:
		adapt: ({dev, config}) => {
			return dev ? {name: 'my-adapter', adapt: ({fs}) => fs.copy(/**/)} : toProdAdapters(config);
		},
	};
};
```

Why the required wrapper function?
It's to avoid a performance footgun:
production adapters may have very large dependencies,
and we want to avoid importing them every time we load our project's config --
which is every time we run a task!

Without lazy adapter imports, every run of `gro` could feel sluggish, even for even small projects,
and this pattern helps us remember to structure our code so it remains fast.

We hope to establish good practice patterns like this early when we can,
even when it means less convenience or simplicity. Helps avoid technical debt.
In this case, the cost is just a wrapper function and dynamic imports,
and the benefit is we ensure good performance for running Gro tasks.
(more specifically, loading a project's Gro config)

## deploying and publishing

Gro has a very clear distinction between **deploy** and **publish**:
`gro publish` is for npm and `gro deploy` is for the web.

> TODO write this section
