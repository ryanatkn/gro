# plugin

During the [`gro dev`](dev.md) and [`gro build`](build.md) tasks,
Gro uses `Plugin`s to support custom usecases outside of the normal build pipeline.

Gro's builtin plugins:

- [`@feltjs/gro_plugin_node_server`](../plugin/gro_plugin_node_server.ts)
- [`@feltjs/gro_plugin_sveltekit_frontend`](../plugin/gro_plugin_sveltekit_frontend.ts)
- [`@feltjs/gro_plugin_gen`](../plugin/gro_plugin_gen.ts)
  (currently disabled, will be replaced with an esbuild plugin)

Also see [`config.plugin` in the config docs](config.md#plugin)
and usage in [the default config](../config/gro.config.default.ts).

The implementation is at [`src/lib/plugin/plugin.ts`](../plugin/plugin.ts) with more details.

```ts
export interface Plugin<TPluginContext extends PluginContext = PluginContext> {
	name: string;
	setup?: (ctx: TPluginContext) => void | Promise<void>;
	teardown?: (ctx: TPluginContext) => void | Promise<void>;
}

export interface PluginContext<TArgs = object> extends TaskContext<TArgs> {
	dev: boolean;
	watch: boolean;
}
```
