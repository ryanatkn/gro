import type {TaskContext} from '../task/task.js';
import type {GroConfig} from './config.js';

/*

Adapting builds for production deployments is a concept borrowed from SvelteKit:
https://kit.svelte.dev/docs#adapters

The general idea is the same:
adapters are little plugins that take production builds as inputs and produce final outputs.

Despite the similarity, Gro's adapter API differs from SvelteKit's,
and interoperability is not a goal yet. (and may never be, can't tell right now)

Returning an empty array causes a no-op.

*/

export interface AdaptBuilds<TArgs = any, TEvents = any> {
	(ctx: AdaptBuildsContext<TArgs, TEvents>):
		| (Adapter<TArgs, TEvents> | (Adapter<TArgs, TEvents> | null)[])
		| Promise<Adapter<TArgs, TEvents> | (Adapter<TArgs, TEvents> | null)[]>;
}

export interface AdaptBuildsContext<TArgs = any, TEvents = any>
	extends TaskContext<TArgs, TEvents> {
	config: GroConfig;
}

export interface Adapter<TArgs = any, TEvents = any> {
	name: string;
	adapt: (ctx: AdaptBuildsContext<TArgs, TEvents>) => void | Promise<void>;
}
