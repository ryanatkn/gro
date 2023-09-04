import {toArray} from '@feltjs/util/array.js';
import type {Timings} from '@feltjs/util/timings.js';

import type {TaskContext} from '../task/task.js';
import type {GroConfig} from '../config/config.js';

/*

Adapting builds for production deployments is a concept borrowed from SvelteKit:
https://kit.svelte.dev/docs#adapters

The general idea is the same:
adapters are little plugins that take production builds as inputs and produce final outputs.

The goal is to remove all of this from Gro: see https://github.com/feltjs/gro/issues/329

*/

export interface Adapter<TArgs = any, TEvents = any> {
	name: string;
	adapt: (ctx: AdapterContext<TArgs, TEvents>) => void | Promise<void>;
}

export interface ToConfigAdapters<TArgs = any, TEvents = any> {
	(
		ctx: AdapterContext<TArgs, TEvents>,
	):
		| (Adapter<TArgs, TEvents> | null | Array<Adapter<TArgs, TEvents> | null>)
		| Promise<Adapter<TArgs, TEvents> | null | Array<Adapter<TArgs, TEvents> | null>>;
}

export interface AdapterContext<TArgs = any, TEvents = any> extends TaskContext<TArgs, TEvents> {
	config: GroConfig;
	dev: boolean;
	timings: Timings;
}

export const adapt = async (ctx: AdapterContext): Promise<readonly Adapter[]> => {
	const {config, timings} = ctx;
	const timingToCreateAdapters = timings.start('create adapters');
	const adapters: Array<Adapter<any, any>> = toArray(await config.adapt(ctx)).filter(
		Boolean,
	) as Array<Adapter<any, any>>;
	timingToCreateAdapters();

	if (adapters.length) {
		const timingToRunAdapters = timings.start('adapt');
		for (const adapter of adapters) {
			if (!adapter.adapt) continue;
			const timing = timings.start(`adapt:${adapter.name}`);
			await adapter.adapt(ctx); // eslint-disable-line no-await-in-loop
			timing();
		}
		timingToRunAdapters();
	}

	return adapters;
};
