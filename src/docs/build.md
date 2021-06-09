# build

This document describes how to go from `gro build` to live websites and npm packages.

> for development, see [dev.md](dev.md)

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

- [adapters](#adapters)
- [adapt](#adapt)
- [deploying and publishing](#deploying-and-publishing)

## adapters

Gro borrows the `Adapter` concept from SvelteKit to help us control our builds.
When we run:

```bash
gro build
```

the build process has two discrete steps:

1. [`Builder`](../build/builder.ts)s run and output production artifacts to `.gro/prod/{build_name}` for each build
2. [`Adapter`](../adapt/adapter.ts)s run and output, umm, anything?
   like SvelteKit apps, Node libraries, API servers, & more !

> as we're thinking about them, `Adapter`s should not modify the contents of `.gro/prod/`;
> adapters take these builds as inputs, and without changing them,
> they output whatever you want, for as long as you want, as messily as you want;
> just no messing with the source, that is forbidden —
> this design lets you run many adapters on one build,
> which means composability & power & efficiency;
> if you find yourself wanting to modify builds in place, try a `Builder` instead
> (the API probably needs improvements and helpers) — open issues if you want to discuss!

An adapter is a small plugin with a few optional hooks:

```ts
export interface Adapter<T_Args = any, T_Events = any> {
	name: string;
	begin?: (ctx: Adapter_Context<T_Args, T_Events>) => void | Promise<void>;
	adapt?: (ctx: Adapter_Context<T_Args, T_Events>) => void | Promise<void>;
	end?: (ctx: Adapter_Context<T_Args, T_Events>) => void | Promise<void>;
}
```

The `Adapter_Context` extends
[Gro's `Task_Context`](../task/README.md#user-content-types-task-and-taskcontext)
with additional properties,
so the `Adapter` hooks and `adapt` config property both have access to
[the normal task environment](../task/README.md) and more:

```ts
export interface Adapter_Context<T_Args = any, T_Events = any>
	extends Task_Context<T_Args, T_Events> {
	config: Gro_Config;
}
```

Gro has a number of builtin adapters. Some are a work in progress:

- [x] [`gro-adapter-node-library`](../adapt/gro-adapter-node-library.ts)
- [ ] [`gro-adapter-api-server`](../adapt/gro-adapter-api-server.ts)
- [x] [`gro-adapter-sveltekit-frontend `](../adapt/gro-adapter-sveltekit-frontend.ts)
- [ ] [`gro-adapter-spa-frontend`](../adapt/gro-adapter-spa-frontend.ts)

## adapt

[Gro configs](config.md) have an optional `adapt` function property
that returns zero or more `Adapter` instances.

To learn how to use adapters and other build options, see [the config docs](config.md).

You may notice that the Gro config `adapt` property is a function that returns `Adapter` instances,
and you may be dismayed that it's not as simple as SvelteKit's API, which has
[an `adapter` property that accepts `Adapter` instances](https://kit.svelte.dev/docs#adapters).
In Gro, there's the `adapt` function property,
a function that returns `Adapter` instances:

```ts
import type {Gro_Config_Creator} from '@feltcoop/gro';

export const config: Gro_Config_Creator = async () => {
	return {
		adapt: async () => [
			(await import('@feltcoop/gro/gro-adapter-sveltekit-frontend.js')).create_adapter(),
			(await import('@feltcoop/gro/gro-adapter-node-library.js')).create_adapter(),
			(await import('@feltcoop/gro/gro-adapter-api-server.js')).create_adapter(),
		],

		// this **does not work**, even though it's simpler!
		adapt: {name: 'my-adapter', adapt: () => {}}, // type error! must be a function or undefined

		// this works: note it does not have to import anything, or be async:
		adapt: () => ({name: 'my-adapter', adapt: () => {}}),

		// both `adapt` and the `Adapter` hooks receive the task context extended with the config:
		adapt: ({dev, config}) => {
			return dev
				? {
						name: 'my-adapter',
						begin: ({fs}) => fs.remove(/**/),
						adapt: ({fs}) => fs.copy(/**/),
						end: ({log}) => log.info('done!'),
				  }
				: toProdAdapters(config);
		},

		// it's ok to return nothing
		adapt: () => null,
		adapt: () => [],
		adapt: () => [null],
	};
};
```

Why must `adapt` be a function, and not just one or more `Adapter` instances?
It's to avoid a performance footgun:
production adapters sometimes have very large dependencies,
and we want to avoid importing them every time we load our project's config —
which is every time we run many tasks!

Without lazy adapter imports, every run of many common tasks could be noticeably sluggish,
even for even small projects,
and this pattern helps us remember to structure our code so it remains fast.

We hope to establish good practice patterns like this early when we can,
even when it means less convenience or simplicity.
Doing so helps us avoid technical debt and mystery slowdowns, even if it wins no beauty contests.
In this case, the cost is just a wrapper function and dynamic imports,
and the benefit is being guided to keep our tools fast.

## deploying and publishing

Now that we can make builds and then adapt them, how do we, like, make them go?
You know, to the web or whatever?

The [`gro deploy`](deploy.md) task helps you output builds to a branch,
like for static publishing to GitHub pages. (TODO needs work)

The [`gro publish`](publish.md) task publishes packages to npm.

Both of these tasks call `gro build` internally
but you can always run it manually if you're curious.
