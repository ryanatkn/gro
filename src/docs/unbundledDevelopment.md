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

Gro's development is still a work in progress, and production usage is discouraged,
but please feel free to try it and share your feedback!

## comparison to Snowpack

Gro's unbundled development is heavily inspired by [Snowpack](https://github.com/pikapkg/snowpack),
which pioneered using ES modules to avoid the unnecessary overhead of bundling during development.
Gro differs in some significant ways:

- Snowpack is focused on frontend websites,
  while Gro is designed for servers and libraries alongside frontends.
- Snowpack is designed to be mostly agnostic to your technology choices
  and supports a wide plugin ecosystem to cater to many choices.
  Gro's goal is to provide an opinionated batteries-included experience
  with a core set of technologies like
  [Svelte](github.com/sveltejs/svelte) and [Prettier](github.com/prettier/prettier).
  Gro does not have a plugin system yet,
  but it has a pluggable compiler architecture that can probably support a lot of things.
  Gro will have plugins eventually, but unlike Snowpack,
  we do not currently plan to develop an ecosystem that strays from core choices.
  Instead, we expect Gro to evolve towards more opinionated choices, not fewer.
- Snowpack is a frontend build tool that's focused on doing that one thing very well.
  Gro has a sprawling scope that includes
  a [task runner](../task), [testing library](../oki), tools for [code generation](../gen),
  and many utilities to fill in gaps for Node and the browser.
  Gro also wraps libraries like [fs-extra](https://github.com/jprichardson/node-fs-extra)
  for a better interface to Node's filesystem and it ships with Prettier to format code.
  Though much of their behavior overlaps, Snowpack and Gro are very different projects.
  > Despite its large scope, Gro tries to minimize its external dependencies.
  > Here's the dependency graphs on npm.anvaka.com for
  > [Gro](https://npm.anvaka.com/#/view/2d/%2540feltcoop%252Fgro),
  > [Snowpack](https://npm.anvaka.com/#/view/2d/snowpack),
  > [Webpack](https://npm.anvaka.com/#/view/2d/webpack),
  > and [Parcel](https://npm.anvaka.com/#/view/2d/parcel),
  > though these counts are not necessarily representative of the average configured project.
- Snowpack emphasizes composing tools through the CLI and plugins.
  Gro emphasizes writing [tasks](./tasks.md) in TypeScript to use libraries directly,
  but we'll probably do more to support CLI integrations.
- Snowpack compiles files on demand when requested by the browser.
  In contrast, Gro compiles files on startup.
  This is a complex set of tradeoffs - for very large projects, Snowpack has a significant edge.
  Gro's design is due to the needs of Node libraries and servers.
  There are plans for Gro to support lazy compilation and other scale-friendly features,
  and its caching system already speeds up heavy workloads.
  The limitation that forces eager loading will likely be fixed before Gro reaches 1.0,
  but Gro's DX will probably be more complex than Snowpack's.
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
