# plugin

During the [`gro dev`](dev.md) and [`gro build`](build.md) tasks,
Gro uses `Plugin`s to support custom usecases outside of the normal build pipeline.

In this early implementation of plugins in Gro,
plugins run serially, in the order they are returned from `plugins` in the `gro.config.ts`.
Each step of Gro's build processes - `gro dev` for development and `gro build` for production -
runs a method of each plugin, batched together as `setup -> adapt -> teardown`,
with some behavioral inconsistencies:

- `adapt` only runs during production aka `gro build`
- `teardown` does not run for `gro dev` in the default `watch` mode,
  but it does run with `gro dev --no-watch`
- there should probably be a finalization step that runs `teardown` on uncaught exceptions

The API needs to be improved for more advanced usecases,
currently it offers little flexibility -
we'll follow the Vite/SvelteKit APIs probably. (`pre` etc)
Maybe let you map the array of each method batch. (is that possible with those?)

Gro's builtin plugins:

- [`@ryanatkn/gro_plugin_server`](../lib/gro_plugin_server.ts) - Node server support
- [`@ryanatkn/gro_plugin_sveltekit_library`](../lib/gro_plugin_sveltekit_library.ts) -
  for publishing from `$lib/` with [`svelte-package`](https://svelte.dev/docs/kit/packaging)
- [`@ryanatkn/gro_plugin_sveltekit_app`](../lib/gro_plugin_sveltekit_app.ts) -
  see [the docs](./gro_plugin_sveltekit_app.md)
- [`@ryanatkn/gro_plugin_gen`](../lib/gro_plugin_gen.ts) - watch `src/`
  and efficiently run `gen` when genfiles or their deps change
- [`@ryanatkn/gro_plugin_moss`](../lib/gro_plugin_moss.ts) - generate the optimized
  [Moss](https://moss.ryanatkn.com/) classes file `$routes/moss.css`,
  efficiently watching `src/` and the deps

> TODO add docs for the above

Also see [`config.plugin` in the config docs](config.md#plugin)
and usage in [the default config](../lib/gro.config.default.ts).
The default config detects which plugins are included by inspecting the current project.

The implementation is at [`src/lib/plugin.ts`](../lib/plugin.ts) with more details.

```ts
export interface Plugin<T_Plugin_Context extends Plugin_Context = Plugin_Context> {
	name: string;
	setup?: (ctx: T_Plugin_Context) => void | Promise<void>;
	adapt?: (ctx: T_Plugin_Context) => void | Promise<void>;
	teardown?: (ctx: T_Plugin_Context) => void | Promise<void>;
}

export interface Plugin_Context<T_Args = object> extends Task_Context<T_Args> {
	dev: boolean;
	watch: boolean;
}
```

The `adapt` step only runs for production during `gro build`, taking after SvelteKit adapters.
