# plugin

During the [`gro dev`](dev.md) and [`gro build`](build.md) tasks,
Gro uses `Plugin`s to support custom usecases outside of the normal build pipeline.

Gro's builtin plugins:

- [`groPluginApiServer`](../plugin/groPluginApiServer.ts)
- [`groPluginSveltekitFrontend `](../plugin/groPluginSveltekitFrontend.ts)

Also see [`config.plugin` in the config docs](config.md#plugin)
and usage in [the default config](../config/gro.config.default.ts).

The implementation is at [`src/plugin/plugin.ts`](../plugin/plugin.ts) with more details.

```ts
export interface Plugin<TArgs = any, TEvents = any> {
	name: string;
	setup?: (ctx: PluginContext<TArgs, TEvents>) => void | Promise<void>;
	teardown?: (ctx: PluginContext<TArgs, TEvents>) => void | Promise<void>;
}
```
