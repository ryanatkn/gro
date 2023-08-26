# dev

Gro is designed to extend [SvelteKit](https://github.com/sveltejs/kit)
with helpful tools. It supports:

- frontends with SvelteKit and [Vite](https://github.com/vitejs/vite)
- Node libraries
- Node API servers

## usage

```bash
gro dev
gro dev --no-watch # outputs dev artifacts and exits without watch mode
```

To configure a project, see [the config docs](config.md).

## plugin

`Plugin`s are objects that customize the behavior of `gro build` and `gro dev`.
See [plugin.md](plugin.md) to learn more.

## todo

- [x] basics
- [ ] add API using esbuild to optionally bundle specific pieces to speed up development
- [ ] livereload CSS (and fix pop-in during dev)
- [ ] HMR
- [ ] probably support Rollup plugins in development, but how?
- [ ] improve loading speed with `cache-control: immutable` and
      [import maps](https://github.com/WICG/import-maps/)
      (on my machine Firefox is much slower than Chrome
      handling a module import waterfall, locally, and http2 didn't help)

<p align="center">
  <a href="https://github.com/feltjs/gro">
    <img src="/src/static/favicon.png" width="192" height="192">
  </a>
</p>
