# adapt

> note: this system is likely going to change as we improve
> [SvelteKit integration](/src/docs/sveltekit.md)

During the [`gro build`](build.md) task,
Gro uses `Adapter`s to convert production builds into final artifacts.

Gro has a number of builtin adapters:

- [`gro-adapter-node-library`](../adapt/gro-adapter-node-library.ts)
- [`gro-adapter-sveltekit-frontend `](../adapt/gro-adapter-sveltekit-frontend.ts)
- [`gro-adapter-generic-build`](../adapt/gro-adapter-generic-build.ts)

Also see [`config.adapt` in the config docs](config.md#adapt)
and usage in [the default config](../config/gro.config.default.ts).

## adapters

Gro borrows the `Adapter` concept from SvelteKit to help us control our builds.
When we run:

```bash
gro build
```

the build process has two discrete steps:

1. [`Builder`](../build/builder.ts)s run and output production artifacts to `.gro/prod/{buildName}` for each build
2. [`Adapter`](../adapt/adapt.ts)s run and output, umm, anything?
   like SvelteKit apps, Node libraries, API servers, & more !

> as we're thinking about them, `Adapter`s should not modify the content of `.gro/prod/`;
> adapters take these builds as inputs, and without changing them,
> they output whatever you want, for as long as you want, as messily as you want;
> just no messing with the source, that is forbidden —
> this design lets you run many adapters on one build,
> which means composability & power & efficiency;
> if you find yourself wanting to modify builds in place, try a `Builder` instead
> (the API probably needs improvements and helpers) — open issues if you want to discuss!

An adapter is an object with an `adapt` hook:

```ts
export interface Adapter<TArgs = any, TEvents = any> {
	name: string;
	adapt: (ctx: AdapterContext<TArgs, TEvents>) => void | Promise<void>;
}
```

The `AdapterContext` extends
[Gro's `TaskContext`](../task/README.md#user-content-types-task-and-taskcontext)
with additional properties,
so the `Adapter` hooks and `adapt` config property both have access to
[the normal task environment](../task/README.md) and more:

```ts
export interface AdapterContext<TArgs = any, TEvents = any> extends TaskContext<TArgs, TEvents> {
	config: GroConfig;
}
```

## config.adapt

[Gro configs](config.md) have an optional `adapt` function property
that returns zero or more `Adapter` instances.

To learn how to use adapters and other build options, see [the config docs](config.md).

You may notice that the Gro config `adapt` property is a function that returns `Adapter` instances,
and you may be dismayed that it's not as simple as SvelteKit's API, which has
[an `adapter` property that accepts `Adapter` instances](https://kit.svelte.dev/docs#adapters).
In Gro, there's the `adapt` function property,
a function that returns `Adapter` instances:

```ts
import type {GroConfigCreator} from '@feltcoop/gro';

export const config: GroConfigCreator = async () => {
	return {
		adapt: async () => [
			(await import('@feltcoop/gro/gro-adapter-sveltekit-frontend.js')).createAdapter(),
			(await import('@feltcoop/gro/gro-adapter-node-library.js')).createAdapter(),
			(await import('@feltcoop/gro/groAdapterApiServer.js')).createAdapter(),
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
						adapt: ({fs}) => {
							fs.remove(/**/);
							fs.copy(/**/);
						},
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
