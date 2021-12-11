# SvelteKit and Vite

Gro is designed to extend SvelteKit and Vite with additional functionality
like [tasks](./task.md), [codegen](./gen.md),
[developing](./dev.md) Node servers,
and [deploying](./deploy.md) to branches.

Gro was created in August 2019 and it has evolved and changed scope substantially,
multiple times. Today, it has decent integration with SvelteKit,
but there's a lot of room for improvement, both to further reduce Gro's scope,
and to add new features and capabilities.

Gro has two important differences from SvelteKit:

- Gro outputs production builds to `/dist`,
  copying from SvelteKit's output `/build` without modifying it,
  and then tasks like `gro deploy` and `gro publish` read from `/dist`, not `/build`
- Gro ignores SvelteKit's [library packaging](https://kit.svelte.dev/docs#packaging)
  capabilities for its own with [`gro publish`](./publish.md)

Beyond this, Gro mostly stays out of SvelteKit's way,
and the eventual goal is to defer to SvelteKit as much as possible.
You can still use `svelte-kit package`
but it doesn't currently integrate with Gro's other systems, checks, and conventions.

Gro's supplemental role is still a work in progress --
in the current implementation, user projects manage their own SvelteKit dependencies,
and commands like `gro dev` and `gro build` automatically detect SvelteKit projects.
