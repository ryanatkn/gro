Gro's supplemental role is still a work in progress --
in the current implementation, user projects manage their own SvelteKit dependencies,
and commands like `gro dev` and `gro build` automatically detect SvelteKit projects

Gro supports both SvelteKit/Vite as well as its own independent system for frontend development,
but Gro's frontend system does not currently support HMR, code splitting, routing,
and many other things provided by SvelteKit.
