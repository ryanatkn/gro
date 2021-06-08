import type {Task_Context} from '../task/task.js';
import type {Gro_Config} from '../config/config.js';

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
	begin?: (ctx: Adapter_Context<T_Args, T_Events>) => void | Promise<void>;
	adapt?: (ctx: Adapter_Context<T_Args, T_Events>) => void | Promise<void>;
	end?: (ctx: Adapter_Context<T_Args, T_Events>) => void | Promise<void>;
}

export interface Adapt_Builds<T_Args = any, T_Events = any> {
	(ctx: Adapter_Context<T_Args, T_Events>):
		| (Adapter<T_Args, T_Events> | null | (Adapter<T_Args, T_Events> | null)[])
		| Promise<Adapter<T_Args, T_Events> | null | (Adapter<T_Args, T_Events> | null)[]>;
}

export interface Adapter_Context<T_Args = any, T_Events = any>
	extends Task_Context<T_Args, T_Events> {
	config: Gro_Config;
}
