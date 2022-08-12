# dev

Gro is designed to be an extensible development tool for both Node projects and
[Svelte](https://github.com/sveltejs/svelte)/[SvelteKit](https://github.com/sveltejs/kit)
user inferfaces.

- frontends with SvelteKit/[Vite](https://github.com/vitejs/vite)
- Svelte apps that also have a server
- Node modules, like libraries and standalone servers

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
- [ ] [support SvelteKit](https://github.com/feltcoop/gro/issues/106) as an alternative to Vite
- [ ] probably support Rollup plugins in development, but how?
- [ ] improve loading speed with `cache-control: immutable` and
      [import maps](https://github.com/WICG/import-maps/)
      (on my machine Firefox is much slower than Chrome
      handling a module import waterfall, locally, and http2 didn't help)

<p align="center">
  <a href="https://github.com/feltcoop/gro">
    <img src="/src/static/favicon.png" width="192" height="192">
  </a>
</p>
