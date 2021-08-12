import {to_array} from '@feltcoop/felt/util/array.js';
import type {Timings} from '@feltcoop/felt/util/timings.js';

import type {TaskContext} from 'src/task/task.js';
import type {GroConfig} from 'src/config/config.js';
import type {Filer} from 'src/build/Filer.js';

/*

Gro `Plugin`s enable custom behavior during `gro dev` and `gro build`.
In contrast, `Adapter`s use the results of `gro build` to produce final artifacts.

*/

export interface Plugin<T_PluginContext extends PluginContext = PluginContext> {
	name: string;
	setup?: (ctx: T_PluginContext) => void | Promise<void>;
	teardown?: (ctx: T_PluginContext) => void | Promise<void>;
}

export interface ToConfigPlugins<T_PluginContext extends PluginContext = PluginContext> {
	(ctx: T_PluginContext):
		| (Plugin<T_PluginContext> | null | (Plugin<T_PluginContext> | null)[])
		| Promise<Plugin<T_PluginContext> | null | (Plugin<T_PluginContext> | null)[]>;
}

export interface PluginContext<T_Args = any, T_Events = any>
	extends TaskContext<T_Args, T_Events> {
	config: GroConfig;
	filer: Filer | null;
	timings: Timings;
}

export class Plugins<T_PluginContext extends PluginContext> {
	constructor(
		private readonly ctx: T_PluginContext,
		private readonly instances: readonly Plugin[],
	) {}

	static async create<T_PluginContext extends PluginContext>(
		ctx: T_PluginContext,
	): Promise<Plugins<T_PluginContext>> {
		const {timings} = ctx;
		const timing_to_create = timings.start('plugins.create');
		const instances: Plugin[] = to_array(await ctx.config.plugin(ctx)).filter(Boolean) as any;
		const plugins = new Plugins(ctx, instances);
		timing_to_create();
		return plugins;
	}

	async setup(): Promise<void> {
		const {ctx, instances} = this;
		if (!this.instances.length) return;
		const {timings} = ctx;
		const timing_to_setup = timings.start('plugins.setup');
		for (const plugin of instances) {
			if (!plugin.setup) continue;
			const timing = timings.start(`setup:${plugin.name}`);
			await plugin.setup(ctx);
			timing();
		}
		timing_to_setup();
	}

	async teardown(): Promise<void> {
		const {ctx, instances} = this;
		if (!this.instances.length) return;
		const {timings} = ctx;
		const timing_to_teardown = timings.start('plugins.teardown');
		for (const plugin of instances) {
			if (!plugin.teardown) continue;
			const timing = timings.start(`teardown:${plugin.name}`);
			await plugin.teardown(ctx);
			timing();
		}
		timing_to_teardown();
	}
}
