# plugin

During the [`gro dev`](dev.md) and [`gro build`](build.md) tasks,
Gro uses `Plugin`s to support custom usecases outside of the normal build pipeline.

Gro's builtin plugins:

- [`gro-plugin-node-library`](../plugin/gro-plugin-node-library.ts)
- [`gro-plugin-sveltekit-frontend `](../plugin/gro-plugin-sveltekit-frontend.ts)

See [`config.plugin` in the config docs](config.md#plugin)
and usage in [the default config](../config/gro.config.default.ts).

The implementation is at [`src/plugin/plugin.ts`](../plugin/plugin.ts) with more details.

```ts
export interface Plugin<T_Args = any, T_Events = any> {
	name: string;
	setup?: (ctx: Plugin_Context<T_Args, T_Events>) => void | Promise<void>;
	teardown?: (ctx: Plugin_Context<T_Args, T_Events>) => void | Promise<void>;
}
```
