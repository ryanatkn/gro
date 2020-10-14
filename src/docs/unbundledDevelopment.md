# unbundled development

Gro is designed to be a most-in-one development tool for both Node projects and
[Svelte](https://github.com/sveltejs/svelte) user inferfaces.
Inspired by [Snowpack](https://github.com/pikapkg/snowpack),
Gro leverages ES modules during development
to avoid the unnecessary overhead and complexity of bundling.
Unlike Snowpack, it's designed for servers and libraries along with frontends.
For production, it uses Rollup to produce efficient bundles.
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
- Snowpack compiles files on demand when requested by the browser
  and bundles external modules during a separate `snowpack install` step.
  In contrast, Gro compiles files on startup
  and bundles external modules when the browser requests them.
  This is a complex set of tradeoffs - for very large projects, Snowpack has a significant edge.
  Gro's strategy has advantages, but its design is forced by current limitations and may change.
  We'll do a more detailed analysis eventually, hopefully.
  There are plans for Gro to support lazy compilation and other scale-friendly features,
  and its caching system already speeds up heavy workloads.
  Furthermore, the limitation that forces eager loading should be fixed before Gro reaches 1.0.
- Gro does not yet support hot module reloading, though work is in progress.
- Gro does not yet have a plugin system
  for things like PostCSS/SASS and UI frameworks besides Svelte.
  It has a pluggable compiler architecture that can probably support most of the ecosystem,
  but it's all a work in progress right now.
  Adventurous developers can define their own tasks
  to extend [Gro's development system](/src/dev.task.ts).
  By default Gro supports TypeScript and Svelte.
  We're not fans of plugin ecosystems that primarily wrap other libraries,
  and instead we try to support the direct usage of Node APIs and libraries,
  like with [tasks](/src/task).
  Snowpack emphasizes composing tools via the CLI; we prefer TypeScript for most things,
  but we'll probably do more to support CLI integrations.
- Gro uses [swc](https://github.com/swc-project/swc)
  instead of [esbuild](https://github.com/evanw/esbuild)
  because the former allows preserving unused imports, which is helpful for Svelte.

<p align="center">
  <a href="https://github.com/feltcoop/gro">
    <img src="/src/frontend/favicon.png" width="192" height="192">
  </a>
</p>
