# gro <img src="src/client/favicon.png" width="32" height="32">

<img src="src/client/favicon.png" align="right" width="192" height="192">

> opinionated tools for web development

> **_warning!_** You should not use Gro today
> unless you're willing to take ownership of the code.
> For now, consider Gro's free software
> [free as in puppy](https://twitter.com/GalaxyKate/status/1371159136684105728),
> meaning you're aware it's a lot of work to maintain,
> and you're inviting it into your home anyway.
> Docs are lacking, some things are in progress, and it might pee on your stuff.
> ([caveat emptor](https://en.wikipedia.org/wiki/Caveat_emptor):
> it's darn cute and quickly becomes a member of the family)
> [SvelteKit](https://github.com/sveltejs/kit) and [Vite](https://github.com/vitejs/vite)
> are probably what you're looking for.
> All that out of the way: you might find some interesting or useful things here!
> Please open issues for questions or discussion
> and [see contributing.md](contributing.md) for more.

> **Windows is not yet supported.** WSL works well enough

## about

Gro is an opin**i**ona**t**ed app framewor**k** or **kit**
for making web frontends, servers, and libraries.
It includes:

- [build system](/src/docs/build.md)
  for [Svelte](https://github.com/sveltejs/svelte) UIs, Node servers/libraries, and other things
  - [unbundled development](/src/docs/dev.md)
    inspired by [Snowpack](https://github.com/pikapkg/snowpack) and using its
    [esinstall](https://github.com/snowpackjs/snowpack/tree/main/esinstall)
  - [configurable adapters](src/docs/build.md#adapters) featuring e.g.
    optional production bundling with [Rollup](https://github.com/rollup/rollup)
  - fully integrated [TypeScript](https://github.com/microsoft/typescript)
    and [Svelte](https://github.com/sveltejs/svelte)
    using [esbuild](https://github.com/evanw/esbuild) in dev mode for speed
  - Gro supports its own form of SPA on the frontend,
    but that functionality is now deprecated-ish for
    [SvelteKit](https://github.com/sveltejs/kit) and [Vite](https://github.com/vitejs/vite)
    with long term plans to
    [offer an alternative to Vite](https://github.com/feltcoop/gro/issues/106)
- [task runner](/src/task) that uses the filesystem convention `*.task.ts`
  (docs at [`src/task`](/src/task))
  - lots of [common default tasks](/src/docs/tasks.md) that projects can easily override and compose
- codegen by convention (docs at [`src/gen`](/src/gen))
- [dev server](/src/server/README.md) with efficient caching and http2/https support
- integrated platform-independent [`fs`](src/fs/filesystem.ts)
  (code is parameterized with an `fs` argument)
  - modeled & implemented with [`fs-extra`](https://github.com/jprichardson/node-fs-extra),
    a drop-in replacement for Node's `fs` with better semantics
  - [memory](src/fs/memory.ts) implementation works everywhere JS runs
  - TODO more, like: `localStorage`, GitHub repo, generic keyvalue stores, a composition/proxy API
- testing with [uvu](https://github.com/lukeed/uvu)
- formatting with [Prettier](https://github.com/prettier/prettier):
  it's not always pretty, but it's always formatted
- more to come, exploring what deeply integrated tools enable
  for developer power, ergonomics, and productivity

## docs

- [build](/src/docs/build.md) web frontends, servers, and libraries
  - [unbundled development](/src/docs/dev.md)
  - [config](/src/docs/config.md)
  - [deploy](/src/docs/deploy.md) to a branch, like for GitHub pages
  - [publish](/src/docs/publish.md)
- [`task`](/src/task#readme) runner
  - [tasks](/src/docs/tasks.md) list
- [dev server](/src/server#readme)
- [`gen`](/src/gen) code generation
- other [docs](/src/docs#readme)
  - [log](/src/docs/log.md)
  - [options](/src/docs/options.md) pattern
  - [philosophy](/src/docs/philosophy.md)

## install

> depends on node >= 14.16

Normally you'll want to install Gro as a dev dependency:

```bash
npm i -D @feltcoop/gro
```

It's handy to install globally too:

```bash
npm i -g @feltcoop/gro
gro # should print some stuff - defers to the project's locally installed version of Gro
```

## usage

```bash
gro # list all available tasks with the pattern `*.task.ts`
gro some/dir # list all tasks inside `src/some/dir`
gro some/file # run `src/some/file.task.ts`
gro some/file.task.ts # same as above
gro test # run `src/test.task.ts` if it exists, falling back to Gro's builtin
```

Gro has a number of builtin tasks that you can run with the CLI.
To learn more [see the task docs](/src/task)
and [the generated task index](/src/docs/tasks.md).

```bash
gro dev # start the dev server in watch mode
```

```bash
gro build # build everything for production
```

Testing with [`uvu`](https://github.com/lukeed/uvu):

```bash
gro test # run all tests for `*.test.ts` files with `uvu`, forwarding CLI args
```

Codegen with `gen` (docs at [`src/gen`](/src/gen))

```bash
gro gen # run codegen for all `*.gen.*` files
gro gen --check # error if any generated files are new or different
```

```bash
gro format # format all of the source files using Prettier
gro format --check # check that all source files are formatted
```

```bash
gro clean # delete all build artifacts from the filesystem
gro clean --svelte --nodemodules --git # also deletes dirs and prunes git branches
```

```bash
gro serve # serve the current directory
gro serve some/dir and/another/dir # serve some directories
```

```bash
gro -v # aka `--version`: print the Gro version
```

```bash
gro check # typecheck, run tests, and ensure generated files are current
gro typecheck # just the typechecking
```

To publish: (also see [`src/docs/publish.md`](src/docs/publish.md))

```bash
gro publish patch # bump version, publish to npm, and sync to GitHub
gro publish major --and args --are forwarded --to 'npm version'
```

## develop

```bash
npm i
npm run bootstrap # build and link `gro` - needed only once
gro test # make sure everything looks good - same as `npm test`

# development
gro dev # start dev server in watch mode; it's designed as a long-running process
gro build # update the `gro` CLI locally

# use your development version of `gro` locally in another project
cd ../otherproject
npm link ../gro

# release
gro build # build for release and update the `gro` CLI
```

## contributing

see [contributing.md🌄](./contributing.md)

## credits :turtle:<sub>:turtle:</sub><sub><sub>:turtle:</sub></sub>

Gro builds on
[TypeScript](https://github.com/microsoft/TypeScript) ∙
[Svelte](https://github.com/sveltejs/svelte) ∙
[esbuild](https://github.com/evanw/esbuild) ∙
[esinstall](https://github.com/snowpackjs/snowpack/tree/main/esinstall) ∙
[Rollup](https://github.com/rollup/rollup) ∙
[uvu](https://github.com/lukeed/uvu) ∙
[fs-extra](https://github.com/jprichardson/node-fs-extra) ∙
[Prettier](https://github.com/prettier/prettier) ∙
[@lukeed\/\*](https://github.com/lukeed) ∙
[Node](https://nodejs.org) & [more](package.json)

[Gro's strategy](/src/docs/dev.md) of pairing unbundled ES modules during development
with optimized bundles for production
was inspired by [Snowpack](https://github.com/pikapkg/snowpack).

Gro's buildtime antics were inspired by [Svelte](https://github.com/sveltejs/svelte).

## license [🐦](https://en.wikipedia.org/wiki/Free_and_open-source_software)

[MIT](LICENSE)
