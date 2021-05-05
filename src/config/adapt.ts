/*

Adapting builds for production deployments is a concept borrowed from SvelteKit:
https://kit.svelte.dev/docs#adapters

The general idea is the same:
adapters are little plugins that take production builds as inputs and produce final outputs.

Despite the similarity, Gro's adapter API differs from SvelteKit's,
and interoperability is not a goal yet. (and may never be, can't tell right now)

*/

export interface AdaptBuilds {
	(): Promise<void | Adapter | Adapter[]>;
}

export interface Adapter {
	name: string;
	adapt: () => Promise<void>;
}
