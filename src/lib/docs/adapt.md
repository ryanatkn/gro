# adapt

During the [`gro build`](build.md) task,
Gro uses `Adapter`s to convert production builds into final artifacts.

Gro has a number of builtin adapters:

- [`@feltjs/gro_adapter_library`](../adapt/gro_adapter_library.ts)
- [`@feltjs/gro_adapter_sveltekit_frontend `](../adapt/gro_adapter_sveltekit_frontend.ts)

Also see [`config.adapt` in the config docs](config.md#adapt)
and usage in [the default config](../config/gro.config.default.ts).

## adapters

Gro borrows the `Adapter` concept from SvelteKit to help us finalize builds.
When we run:

```bash
gro build
```

the build process has two discrete steps:

1. [`Plugin`](../plugin/plugin.ts)s run and output production artifacts,
   deferring to tools like SvelteKit and Vite without modifications when possible
2. [`Adapter`](../adapt/adapt.ts)s run to perform any finalization for production,
   like running `npm link` for Node libraries or adding `.nojekyll` for GitHub Pages

An adapter is an object with an `adapt` hook:

```ts
export interface Adapter<TArgs = any> {
	name: string;
	adapt: (ctx: AdapterContext<TArgs>) => void | Promise<void>;
}
```

The `AdapterContext` extends
[Gro's `TaskContext`](../task/README.md#user-content-types-task-and-taskcontext)
with additional properties,
so the `Adapter` hooks and `adapt` config property both have access to
[the normal task environment](../task/README.md) and more:

```ts
export interface AdapterContext<TArgs = any> extends TaskContext<TArgs> {}
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
import type {GroConfigCreator} from '@feltjs/gro';

const config: GroConfigCreator = async () => {
	return {
		adapt: async () => [
			(await import('@feltjs/gro/gro_adapter_sveltekit_frontend.js')).create_adapter(),
			(await import('@feltjs/gro/gro_adapter_library.js')).create_adapter(),
			(await import('@feltjs/gro/groAdapterApiServer.js')).create_adapter(),
		],

		// this **does not work**, even though it's simpler!
		adapt: {name: 'my-adapter', adapt: () => {}}, // type error! must be a function or undefined

		// this works: note it does not have to import anything, or be async:
		adapt: () => ({name: 'my-adapter', adapt: () => {}}),

		// it's ok to return nothing
		adapt: () => null,
		adapt: () => [],
		adapt: () => [null],
	};
};

export default config;
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
