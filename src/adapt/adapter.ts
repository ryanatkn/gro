import type {TaskContext} from '../task/task.js';
import type {GroConfig} from '../config/config.js';

/*

Adapting builds for production deployments is a concept borrowed from SvelteKit:
https://kit.svelte.dev/docs#adapters

The general idea is the same:
adapters are little plugins that take production builds as inputs and produce final outputs.

Despite the similarity, Gro's adapter API differs from SvelteKit's,
and interoperability is not a goal yet. (and may never be, can't tell right now)

*/

export interface Adapter<TArgs = any, TEvents = any> {
	name: string;
	begin?: (ctx: AdapterContext<TArgs, TEvents>) => void | Promise<void>;
	adapt?: (ctx: AdapterContext<TArgs, TEvents>) => void | Promise<void>;
	end?: (ctx: AdapterContext<TArgs, TEvents>) => void | Promise<void>;
}

export interface AdaptBuilds<TArgs = any, TEvents = any> {
	(ctx: AdapterContext<TArgs, TEvents>):
		| (Adapter<TArgs, TEvents> | null | (Adapter<TArgs, TEvents> | null)[])
		| Promise<Adapter<TArgs, TEvents> | null | (Adapter<TArgs, TEvents> | null)[]>;
}

export interface AdapterContext<TArgs = any, TEvents = any> extends TaskContext<TArgs, TEvents> {
	config: GroConfig;
}
