# unbundled development

Gro is designed to be a most-in-one development tool for both Node projects and
[Svelte](https://github.com/sveltejs/svelte) user inferfaces.
Inspired by [Snowpack](https://github.com/pikapkg/snowpack),
Gro leverages ES modules during development
to avoid the unnecessary overhead and complexity of bundling.
For production, it uses Rollup to produce efficient bundles.
The result is the best of both worlds:
fast iteration with straightforward builds during development,
and uncompromising efficiency for production.

Today, Gro is aimed at two primary use cases:

- single page applications with Svelte
- Node modules

In the long run, Gro plans to add support for server side rendering and static site generation,
but today these are low priority.
We recommend using [Sapper](https://github.com/sveltejs/sapper) for most websites.
Gro is primarily intended for SPAs and Node projects,
and it won't reach a stable 1.0 for quite a while.

Gro tries to provide good defaults and full control when you need it.
Its philosophy is to offer sharp tools
that prioritize efficiency and minimize dependencies.
Sharp tools have a drawback, and aren't the best experience for all developers -
they can hurt when held in certain ways!

Gro's development is still a work in progress, and production usage is discouraged,
but please feel free to try it and share your feedback!

## comparison to Snowpack

Gro's unbundled development is heavily inspired by [Snowpack](https://github.com/pikapkg/snowpack),
which pioneered using ES modules to avoid the unnecessary overhead of bundling during development.
Gro differs in some significant ways:

- Snowpack is focused on frontend websites,
  and Gro is designed to support both frontend and Node projects
- Snowpack compiles files on demand when requested by the browser
  and bundles external modules during a separate `snowpack install` step.
  In contrast, Gro compiles files on startup
  and bundles external modules when the browser requests them.
  This is a complex set of tradeoffs - for very large projects, Snowpack has a significant edge,
  but Gro's strategy has advantages.
  There are plans for Gro to support lazy compilation and other scale-friendly features,
  and some of Gro's design decisions may change before it reaches 1.0.
- Gro does not yet support hot module reloading, though work is in progress.
- Gro does not have a plugin system for things like PostCSS/SASS and UI frameworks besides Svelte.
  It has a pluggable compiler architecture that can probably support most of the ecosystem,
  but it's all a work in progress right now.
  Adventurous developers can [define their own tasks](src/dev.task.ts)
  to extend Gro's development system. By default Gro supports TypeScript and Svelte.
- Gro uses [swc](https://github.com/swc-project/swc)
  instead of [esbuild](https://github.com/evanw/esbuild)
  because the former allows preserving unused imports, which is helpful for Svelte.
