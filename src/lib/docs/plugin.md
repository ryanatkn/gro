# plugin

During the [`gro dev`](dev.md) and [`gro build`](build.md) tasks,
Gro uses `Plugin`s to support custom usecases outside of the normal build pipeline.

Gro's builtin plugins:

- [`@grogarden/gro_plugin_server`](../gro_plugin_server.ts)
- [`@grogarden/gro_plugin_library`](../gro_plugin_library.ts)
- [`@grogarden/gro_plugin_sveltekit_frontend`](../gro_plugin_sveltekit_frontend.ts)
- [`@grogarden/gro_plugin_gen`](../gro_plugin_gen.ts)
  (currently disabled, will be replaced with an esbuild plugin)

Also see [`config.plugin` in the config docs](config.md#plugin)
and usage in [the default config](../gro.config.default.ts).

The implementation is at [`src/lib/plugin.ts`](../plugin.ts) with more details.

```ts
export interface Plugin<TPluginContext extends PluginContext = PluginContext> {
	name: string;
	setup?: (ctx: TPluginContext) => void | Promise<void>;
	adapt?: (ctx: TPluginContext) => void | Promise<void>;
	teardown?: (ctx: TPluginContext) => void | Promise<void>;
}

export interface PluginContext<TArgs = object> extends TaskContext<TArgs> {
	dev: boolean;
	watch: boolean;
}
```

The `adapt` step only runs for production during `gro build`, taking after SvelteKit adapters.
