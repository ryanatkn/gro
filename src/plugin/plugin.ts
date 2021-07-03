import {to_array} from '@feltcoop/felt/util/array.js';
import type {Timings} from '@feltcoop/felt/util/time.js';

import type {Task_Context} from '../task/task.js';
import type {Gro_Config} from '../config/config.js';
import type {Filer} from 'src/build/Filer.js';

/*

Gro `Plugin`s enable custom behavior during `gro dev` and `gro build`.
In contrast, `Adapter`s use the results of `gro build` to produce final artifacts.

*/

export interface Plugin<T_Args = any, T_Events = any> {
	name: string;
	setup?: (ctx: Plugin_Context<T_Args, T_Events>) => void | Promise<void>;
	teardown?: (ctx: Plugin_Context<T_Args, T_Events>) => void | Promise<void>;
}

export interface To_Config_Plugins<T_Args = any, T_Events = any> {
	(ctx: Plugin_Context<T_Args, T_Events>):
		| (Plugin<T_Args, T_Events> | null | (Plugin<T_Args, T_Events> | null)[])
		| Promise<Plugin<T_Args, T_Events> | null | (Plugin<T_Args, T_Events> | null)[]>;
}

export interface Plugin_Context<T_Args = any, T_Events = any>
	extends Task_Context<T_Args, T_Events> {
	config: Gro_Config;
	filer: Filer | null;
	timings: Timings;
}

export class Plugins {
	constructor(
		private readonly ctx: Plugin_Context,
		private readonly instances: readonly Plugin[],
	) {}

	static async create(ctx: Plugin_Context): Promise<Plugins> {
		const {timings} = ctx;
		const timing_to_create = timings.start('plugins.create');
		const instances: Plugin<any, any>[] = to_array(await ctx.config.plugin(ctx)).filter(
			Boolean,
		) as Plugin<any, any>[];
		const plugins = new Plugins(ctx, instances);
		timing_to_create();
		return plugins;
	}

	async setup(): Promise<void> {
		const {timings} = this.ctx;
		const timing_to_setup = timings.start('plugins.setup');
		for (const plugin of this.instances) {
			if (!plugin.setup) continue;
			const timing = timings.start(`setup:${plugin.name}`);
			await plugin.setup(this.ctx);
			timing();
		}
		timing_to_setup();
	}

	async teardown(): Promise<void> {
		const {timings} = this.ctx;
		const timing_to_teardown = timings.start('plugins.teardown');
		for (const plugin of this.instances) {
			if (!plugin.teardown) continue;
			const timing = timings.start(`teardown:${plugin.name}`);
			await plugin.teardown(this.ctx);
			timing();
		}
		timing_to_teardown();
	}
}
