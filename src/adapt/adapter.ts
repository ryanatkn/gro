import {to_array} from '@feltcoop/felt/util/array.js';
import type {Timings} from '@feltcoop/felt/util/timings.js';

import type {Task_Context} from 'src/task/task.js';
import type {Gro_Config} from 'src/config/config.js';

/*

Adapting builds for production deployments is a concept borrowed from SvelteKit:
https://kit.svelte.dev/docs#adapters

The general idea is the same:
adapters are little plugins that take production builds as inputs and produce final outputs.

Despite the similarity, Gro's adapter API differs from SvelteKit's,
and interoperability is not a goal yet. (and may never be, can't tell right now)

*/

export interface Adapter<T_Args = any, T_Events = any> {
	name: string;
	adapt: (ctx: Adapter_Context<T_Args, T_Events>) => void | Promise<void>;
}

export interface To_Config_Adapters<T_Args = any, T_Events = any> {
	(ctx: Adapter_Context<T_Args, T_Events>):
		| (Adapter<T_Args, T_Events> | null | (Adapter<T_Args, T_Events> | null)[])
		| Promise<Adapter<T_Args, T_Events> | null | (Adapter<T_Args, T_Events> | null)[]>;
}

export interface Adapter_Context<T_Args = any, T_Events = any>
	extends Task_Context<T_Args, T_Events> {
	config: Gro_Config;
	timings: Timings;
}

export const adapt = async (ctx: Adapter_Context): Promise<readonly Adapter[]> => {
	const {config, timings} = ctx;
	const timing_to_create_adapters = timings.start('create adapters');
	const adapters: Adapter<any, any>[] = to_array(await config.adapt(ctx)).filter(
		Boolean,
	) as Adapter<any, any>[];
	timing_to_create_adapters();

	if (adapters.length) {
		const timing_to_run_adapters = timings.start('adapt');
		for (const adapter of adapters) {
			if (!adapter.adapt) continue;
			const timing = timings.start(`adapt:${adapter.name}`);
			await adapter.adapt(ctx);
			timing();
		}
		timing_to_run_adapters();
	}

	return adapters;
};
