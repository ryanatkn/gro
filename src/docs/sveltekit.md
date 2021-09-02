# SvelteKit and Vite

Today, Gro sits atop SvelteKit and Vite to provide additional functionality
like tasks, developing Node servers, publishing to Node, and deploying to branches.
Gro's current plan is to integrate with SvelteKit as an alternative to Vite,
but that goal may change.

Gro currently ignores SvelteKit's library publishing capabilities for its own,
but other than that, Gro mostly stays out of SvelteKit's way.

Gro's supplemental role is still a work in progress --
in the current implementation, user projects manage their own SvelteKit dependencies,
and commands like `gro dev` and `gro build` automatically detect SvelteKit projects

Gro supports SvelteKit+Vite along with its own non-conflicting system for frontend development,
but Gro's frontend system does not currently support HMR, code splitting, routing,
and many other things provided by SvelteKit+Vite.
Gro's frontend functionality simply uses Rollup to get minimal bundles,
and it's only appropriate for a small number of specific usecases.
SvelteKit should be preferred by users today,
and Gro's frontend conventions are currently undocumented.
If you're curious, examples of Gro's frontend functionality include Gro's `src/client` and
[`ryanatkn/mirror-twin-gro`](https://github.com/ryanatkn/mirror-twin-gro).
