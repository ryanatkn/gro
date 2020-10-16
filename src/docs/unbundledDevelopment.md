# unbundled development

Gro is designed to be a most-in-one development tool for both Node projects and
[Svelte](https://github.com/sveltejs/svelte) user inferfaces.
Inspired by [Snowpack](https://github.com/pikapkg/snowpack),
Gro leverages ES modules during development
to avoid the unnecessary overhead and complexity of bundling.
Unlike Snowpack, it's designed for servers and libraries along with frontends.
See below for [a deeper comparison](#comparison-to-snowpack).

For production, Gro uses Rollup to produce efficient bundles.
The result is the best of both worlds:
fast iteration with straightforward builds during development,
and uncompromising efficiency for production.

Today, Gro is aimed at three primary use cases:

- single page applications (SPAs) with Svelte
- single page Svelte applications that also have a server
- Node modules, like libraries and standalone servers

Eventually, Gro plans to support
server side rendering (SSR) and static site generation (SSG),
but today these are low priority.
We recommend using [Sapper](https://github.com/sveltejs/sapper) for most websites.
Gro is primarily intended for SPAs and Node projects,
and **it won't reach a stable production-ready 1.0 for quite a while.**

> SPAs without SSR are a niche use case - they're usually **not** what you want on the web!
> But sometimes they're _exactly_ what you want, and Gro was purpose-built to support them.

Gro tries to provide good defaults and full control when you need it.
Its philosophy is to offer sharp tools
that prioritize efficiency and minimize dependencies.
Sharp tools have a drawback, and aren't the best experience for all developers -
they can hurt when held in certain ways! Try not to get cut! :O

Gro's development is still a work in progress, and production usage is discouraged,
but please feel free to try it and share your feedback!

## comparison to Snowpack

Gro's unbundled development is heavily inspired by [Snowpack](https://github.com/pikapkg/snowpack),
which pioneered using ES modules to avoid the unnecessary overhead of bundling during development.
Gro differs in some significant ways:

- Snowpack is focused on frontend websites,
  and Gro is designed to support frontends along with servers and libraries.
- Snowpack is designed to be mostly agnostic to your technology choices
  and supports a wide plugin ecosystem to cater to many choices.
  Gro's goal is to provide a fully integrated, focused, and opinionated experience
  with a core set of technologies like Svelte and TypeScript.
  Gro does not have a plugin system yet,
  but it has a pluggable compiler architecture that can probably support a lot of things.
  Gro will have plugins eventually, but unlike Snowpack,
  we do not currently plan to develop an ecosystem that strays from core choices.
  Instead, Gro's will likely evolve towards integrating more opinionated choices, not fewer.
- Snowpack emphasizes composing tools via the CLI and through plugins.
  Gro emphasizes writing tasks in TypeScript to use libraries directly,
  but we'll probably do more to support CLI integrations.
- Snowpack compiles files on demand when requested by the browser.
  In contrast, Gro compiles files on startup and caches to disk to avoid most wasted work.
  This is a complex set of tradeoffs - for very large projects, Snowpack has a significant edge.
  Gro's strategy has advantages, but its design is forced by current limitations and may change.
  Its current design fits the needs of Node libraries and servers.
  There are plans for Gro to support lazy compilation and other scale-friendly features,
  and its caching system already speeds up heavy workloads.
  The limitation that forces eager loading will likely be fixed before Gro reaches 1.0
  but it's likely to be a more complex DX than Snowpack.
- Gro does not yet support hot module reloading, though work is in progress.
- Gro uses [swc](https://github.com/swc-project/swc)
  instead of [esbuild](https://github.com/evanw/esbuild)
  because the former allows preserving unused imports without additional processing,
  which is helpful for Svelte.

<p align="center">
  <a href="https://github.com/feltcoop/gro">
    <img src="/src/frontend/favicon.png" width="192" height="192">
  </a>
</p>
