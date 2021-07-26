import {to_array} from '@feltcoop/felt/util/array.js';
import type {Timings} from '@feltcoop/felt/util/timings.js';

import type {Task_Context} from 'src/task/task.js';
import type {Gro_Config} from 'src/config/config.js';
import type {Filer} from 'src/build/Filer.js';

/*

Gro `Plugin`s enable custom behavior during `gro dev` and `gro build`.
In contrast, `Adapter`s use the results of `gro build` to produce final artifacts.

*/

export interface Plugin<T_Plugin_Context extends Plugin_Context = Plugin_Context> {
	name: string;
	setup?: (ctx: T_Plugin_Context) => void | Promise<void>;
	teardown?: (ctx: T_Plugin_Context) => void | Promise<void>;
}

export interface To_Config_Plugins<T_Plugin_Context extends Plugin_Context = Plugin_Context> {
	(ctx: T_Plugin_Context):
		| (Plugin<T_Plugin_Context> | null | (Plugin<T_Plugin_Context> | null)[])
		| Promise<Plugin<T_Plugin_Context> | null | (Plugin<T_Plugin_Context> | null)[]>;
}

export interface Plugin_Context<T_Args = any, T_Events = any>
	extends Task_Context<T_Args, T_Events> {
	config: Gro_Config;
	filer: Filer | null;
	timings: Timings;
}

export class Plugins<T_Plugin_Context extends Plugin_Context> {
	constructor(
		private readonly ctx: T_Plugin_Context,
		private readonly instances: readonly Plugin[],
	) {}

	static async create<T_Plugin_Context extends Plugin_Context>(
		ctx: T_Plugin_Context,
	): Promise<Plugins<T_Plugin_Context>> {
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
