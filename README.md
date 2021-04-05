# gro <img src="src/client/favicon.png" width="32" height="32">

<img src="src/client/favicon.png" align="right" width="192" height="192">

> opinionated tools for web development

> **_warning!_** You should not use Gro today
> unless you're willing to take ownership of the code.
> For now, consider Gro's free software
> [free as in puppy](https://twitter.com/GalaxyKate/status/1371159136684105728),
> meaning you're aware it's a lot of work to maintain,
> and you're allowing it into your home anyway.
> Docs are lacking, some things are in progress, and it might pee on your stuff.
> ([caveat emptor](https://en.wikipedia.org/wiki/Caveat_emptor):
> it's darn cute and quickly becomes a member of the family)
> [SvelteKit](https://github.com/sveltejs/kit) and [Vite](https://github.com/vitejs/vite)
> are probably what you're looking for.
> All that out of the way: you might find some interesting or useful things here!
> Please open issues for questions or discussion.

## about

Gro is an opin**i**ona**t**ed app framewor**k** or **kit**
for making web frontends, servers, and libraries.
It includes:

- [unbundled development](/src/docs/unbundled.md)
  for [Svelte](https://github.com/sveltejs/svelte) UIs
  and integrated tools for Node servers and libraries
  (inspired by [Snowpack](https://github.com/pikapkg/snowpack) and backed by
  [esinstall](https://github.com/snowpackjs/snowpack/tree/main/esinstall))
  - Gro supports SPAs on the frontend,
    but that functionality is now deprecated for
    [SvelteKit](https://github.com/sveltejs/kit) and [Vite](https://github.com/vitejs/vite),
    with long term plans to
    [offer an alternative to Vite](https://github.com/feltcoop/gro/issues/106)
- production bundling with [Rollup](https://github.com/rollup/rollup)
- fully integrated [TypeScript](https://github.com/microsoft/typescript)
  using [esbuild](https://github.com/evanw/esbuild) in dev mode for speed
- [task runner](/src/task) that uses the filesystem convention `*.task.ts`
  (docs at [`src/task`](/src/task))
- codegen by convention called `gen` (docs at [`src/gen`](/src/gen))
- dev server with efficient caching and http2/https support
- filesystem-abstracting build system that considers any wasted work a bug,
  unless it's a deliberate tradeoff
- testing with [uvu](https://github.com/lukeed/uvu)
- formatting with [Prettier](https://github.com/prettier/prettier);
  it's not always pretty, but it's always formatted
- utilities to fill in the gaps for Node and the browser
- more to come, exploring what deeply integrated tools enable
  for developer power, ergonomics, and productivity

## docs

- [unbundled development](/src/docs/unbundled.md) for web frontends, servers, and libraries
- [`task`](/src/task) runner
- [dev server](/src/server)
- [`gen`](/src/gen) code generation
- other [docs](/src/docs)
  - [tasks](/src/docs/tasks.md)
  - [config](/src/docs/config.md)
  - [publish](/src/docs/publish.md)
  - [options](/src/docs/options.md)

## install

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
```

```bash
gro serve # serve the current directory
gro serve some/dir and/another/dir # serve some directories
```

```bash
gro version patch # bump version, publish to npm, and sync to GitHub
gro version major --and args --are forwarded --to 'npm version'
```

```bash
gro -v # aka `--version`: print the Gro version
```

```bash
gro check # typecheck, run tests, and ensure generated files are current
gro typecheck # just the typechecking
```

## develop

```bash
npm i
npm run bootstrap # build and link `gro` - needed only once
gro test # make sure everything looks good - same as `npm test`

# development
gro dev # start dev server in watch mode
gro project/dist # update the `gro` CLI

# release
gro build # build for release and update the `gro` CLI
```

## credits :turtle:<sub>:turtle:</sub><sub><sub>:turtle:</sub></sub>

Gro builds on
[Svelte](https://github.com/sveltejs/svelte) ∙
[Rollup](https://github.com/rollup/rollup) ∙
[TypeScript](https://github.com/microsoft/TypeScript) ∙
[esbuild](https://github.com/evanw/esbuild) ∙
[esinstall](https://github.com/snowpackjs/snowpack/tree/main/esinstall) ∙
[uvu](https://github.com/lukeed/uvu) ∙
[Prettier](https://github.com/prettier/prettier) ∙
[@lukeed\/\*](https://github.com/lukeed) ∙
[Node](https://nodejs.org) & [more](package.json)

[Gro's strategy](/src/docs/unbundled.md) of pairing unbundled ES modules during development
with optimized bundles for production
was inspired by [Snowpack](https://github.com/pikapkg/snowpack).

Gro's buildtime antics were inspired by [Svelte](https://github.com/sveltejs/svelte).

## license :bird:

[MIT](LICENSE)
