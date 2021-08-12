import {to_array} from '@feltcoop/felt/util/array.js';
import type {Timings} from '@feltcoop/felt/util/timings.js';

import type {TaskContext} from 'src/task/task.js';
import type {GroConfig} from 'src/config/config.js';
import type {Filer} from 'src/build/Filer.js';

/*

Gro `Plugin`s enable custom behavior during `gro dev` and `gro build`.
In contrast, `Adapter`s use the results of `gro build` to produce final artifacts.

*/

export interface Plugin<TPluginContext extends PluginContext = PluginContext> {
	name: string;
	setup?: (ctx: TPluginContext) => void | Promise<void>;
	teardown?: (ctx: TPluginContext) => void | Promise<void>;
}

export interface ToConfigPlugins<TPluginContext extends PluginContext = PluginContext> {
	(ctx: TPluginContext):
		| (Plugin<TPluginContext> | null | (Plugin<TPluginContext> | null)[])
		| Promise<Plugin<TPluginContext> | null | (Plugin<TPluginContext> | null)[]>;
}

export interface PluginContext<TArgs = any, TEvents = any> extends TaskContext<TArgs, TEvents> {
	config: GroConfig;
	filer: Filer | null;
	timings: Timings;
}

export class Plugins<TPluginContext extends PluginContext> {
	constructor(
		private readonly ctx: TPluginContext,
		private readonly instances: readonly Plugin[],
	) {}

	static async create<TPluginContext extends PluginContext>(
		ctx: TPluginContext,
	): Promise<Plugins<TPluginContext>> {
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
