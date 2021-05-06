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

// TODO defaulting to `any` might be a problem
export interface AdaptBuilds<TArgs = any, TEvents = any> {
	(ctx: AdaptBuildsContext<TArgs, TEvents>): Promise<Adapter | Adapter[]>;
}

export interface AdaptBuildsContext<TArgs, TEvents> extends TaskContext<TArgs, TEvents> {
	config: GroConfig;
}

export interface Adapter {
	name: string;
	adapt: <TArgs, TEvents>(ctx: AdaptBuildsContext<TArgs, TEvents>) => Promise<void>;
}
