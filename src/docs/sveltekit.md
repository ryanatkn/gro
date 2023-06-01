# SvelteKit and Vite

Gro is designed to extend SvelteKit and Vite with additional functionality
like [tasks](./task.md), [codegen](./gen.md),
[developing](./dev.md) Node servers,
and [deploying](./deploy.md) to branches.

Gro was created in August 2019 and it has evolved and changed scope substantially, multiple times.
When I started Gro I didn't know about the emerging super fast TypeScript
transpilers like `swc` and `esbuild`,
and so [its efficient caching build system](./config.md) is
[no longer needed](https://github.com/feltjs/gro/issues/333)
for things like tasks.

[SvelteKit was announced](https://www.youtube.com/watch?v=qSfdtmcZ4d0)
in October 2020, over a year after Gro broke ground,
and Gro now wants to extend SvelteKit and stay completely out of its way.
SvelteKit uses [Vite](https://github.com/vitejs/vite) (April 2020),
an amazing piece of software that allows us to
cut much of Gro's current scope
([#329](https://github.com/feltjs/gro/issues/329),
[#333](https://github.com/feltjs/gro/issues/333)).
Today, Gro has decent integration with SvelteKit and Vite,
but there's a lot of room for improvement, both to further reduce Gro's scope
and to add new features and capabilities.

Gro has at least two important differences from SvelteKit:

- Gro outputs production builds to `/dist`,
  copying from SvelteKit's output `/build` without modifying it,
  and then tasks like `gro deploy` and `gro publish` read from `/dist`, not `/build`
  (see [issue #333](https://github.com/feltjs/gro/issues/333))
- Gro ignores SvelteKit's [library packaging](https://kit.svelte.dev/docs#packaging)
  capabilities for its own with [`gro publish`](./publish.md)
  (see [issue #329](https://github.com/feltjs/gro/issues/329))

Beyond this, Gro mostly stays out of SvelteKit's way,
and the eventual goal is to defer to SvelteKit as much as possible.
You can still use `svelte-kit package`
but it doesn't currently integrate with Gro's other systems, checks, and conventions.

Gro's supplemental role is still a work in progress --
if you have questions or want to help, please feel invited to open issues
or email me: ryan at felt dot social.
