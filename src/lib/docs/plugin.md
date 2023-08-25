# plugin

> note: this system is likely going to change as we improve
> [SvelteKit integration](/src/lib/docs/sveltekit.md)

During the [`gro dev`](dev.md) and [`gro build`](build.md) tasks,
Gro uses `Plugin`s to support custom usecases outside of the normal build pipeline.

Gro's builtin plugins:

- [`@feltjs/gro-plugin-api-server`](../plugin/gro-plugin-api-server.ts)
- [`@feltjs/gro-plugin-sveltekit-frontend`](../plugin/gro-plugin-sveltekit-frontend.ts)
- [`@feltjs/gro-plugin-gen`](../plugin/gro-plugin-gen.ts)

Also see [`config.plugin` in the config docs](config.md#plugin)
and usage in [the default config](../config/gro.config.default.ts).

The implementation is at [`src/lib/plugin/plugin.ts`](../plugin/plugin.ts) with more details.

```ts
export interface Plugin<TArgs = any, TEvents = any> {
	name: string;
	setup?: (ctx: PluginContext<TArgs, TEvents>) => void | Promise<void>;
	teardown?: (ctx: PluginContext<TArgs, TEvents>) => void | Promise<void>;
}
```
