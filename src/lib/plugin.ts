import type {Task_Context} from './task.js';

/**
 * Gro `Plugin`s enable custom behavior during `gro dev` and `gro build`.
 * In contrast, `Adapter`s use the results of `gro build` to produce final artifacts.
 */
export interface Plugin<T_Plugin_Context extends Plugin_Context = Plugin_Context> {
	name: string;
	setup?: (ctx: T_Plugin_Context) => void | Promise<void>;
	adapt?: (ctx: T_Plugin_Context) => void | Promise<void>;
	teardown?: (ctx: T_Plugin_Context) => void | Promise<void>;
}

export type Create_Config_Plugins<T_Plugin_Context extends Plugin_Context = Plugin_Context> = (
	ctx: T_Plugin_Context,
) => Array<Plugin<T_Plugin_Context>> | Promise<Array<Plugin<T_Plugin_Context>>>;

export interface Plugin_Context<T_Args = object> extends Task_Context<T_Args> {
	dev: boolean;
	watch: boolean;
}

export class Plugins<T_Plugin_Context extends Plugin_Context> {
	/* prefer `Plugins.create` to the constructor */
	constructor(
		private ctx: T_Plugin_Context,
		private instances: Array<Plugin>,
	) {}

	static async create<T_Plugin_Context extends Plugin_Context>(
		ctx: T_Plugin_Context,
	): Promise<Plugins<T_Plugin_Context>> {
		const {timings} = ctx;
		const timing_to_create = timings.start('plugins.create');
		const instances: Array<Plugin> = await ctx.config.plugins(ctx);
		const plugins = new Plugins(ctx, instances);
		timing_to_create();
		return plugins;
	}

	async setup(): Promise<void> {
		const {ctx, instances} = this;
		if (!instances.length) return;
		const {timings, log} = ctx;
		const timing_to_setup = timings.start('plugins.setup');
		for (const plugin of instances) {
			if (!plugin.setup) continue;
			log.debug('setup plugin', plugin.name);
			const timing = timings.start(`setup:${plugin.name}`);
			await plugin.setup(ctx); // eslint-disable-line no-await-in-loop
			timing();
		}
		timing_to_setup();
	}

	async adapt(): Promise<void> {
		const {ctx, instances} = this;
		const {timings} = ctx;
		const timing_to_run_adapters = timings.start('plugins.adapt');
		for (const plugin of instances) {
			if (!plugin.adapt) continue;
			const timing = timings.start(`adapt:${plugin.name}`);
			await plugin.adapt(ctx); // eslint-disable-line no-await-in-loop
			timing();
		}
		timing_to_run_adapters();
	}

	async teardown(): Promise<void> {
		const {ctx, instances} = this;
		if (!instances.length) return;
		const {timings, log} = ctx;
		const timing_to_teardown = timings.start('plugins.teardown');
		for (const plugin of instances) {
			if (!plugin.teardown) continue;
			log.debug('teardown plugin', plugin.name);
			const timing = timings.start(`teardown:${plugin.name}`);
			await plugin.teardown(ctx); // eslint-disable-line no-await-in-loop
			timing();
		}
		timing_to_teardown();
	}
}

/**
 * Replaces a plugin by name in `plugins` without mutating the param.
 * Throws if the plugin name cannot be found.
 * @param plugins - accepts the same types as the return value of `Create_Config_Plugins`
 * @param new_plugin
 * @param name - @default new_plugin.name
 * @returns `plugins` with `new_plugin` at the index of the plugin with `name`
 */
export const replace_plugin = (
	plugins: Array<Plugin>,
	new_plugin: Plugin,
	name = new_plugin.name,
): Array<Plugin> => {
	const index = plugins.findIndex((p) => p.name === name);
	if (index === -1) throw Error('Failed to find plugin to replace: ' + name);
	const replaced = plugins.slice();
	replaced[index] = new_plugin;
	return replaced;
};
