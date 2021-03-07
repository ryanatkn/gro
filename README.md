# gro <img src="src/client/favicon.png" width="32" height="32">

<img src="src/client/favicon.png" align="right" width="192" height="192">

> opinionated tools for web development

> **_warning!_** You should not use Gro today
> unless you're willing to take ownership of the code.
> Expect bugs, missing features, and undocumented breaking changes.
> In fact don't expect any documentation.. or .. just don't expect anything.
> Gro integrates several tools into a single experience but it's pre-alpha,
> and there are many mature substitutes with large communities.
> That said, you might find some interesting or useful things here!
> Feel free to open issues for questions or discussion.

## about

Gro is an opinionated monotool ("kit", "metaframework"?) for making webapps.
It includes:

- [unbundled development](/src/docs/unbundledDevelopment.md)
  for [Svelte](https://github.com/sveltejs/svelte) UIs and Node servers/libraries,
  inspired by [Snowpack](https://github.com/pikapkg/snowpack)
- production bundling via [Rollup](https://github.com/rollup/rollup)
- fully integrated [TypeScript](https://github.com/microsoft/typescript)
  using [swc](https://github.com/swc-project/swc) in dev mode for speed
- [task runner](/src/task) that uses the filesystem convention `*.task.ts`
  (docs at [`src/task`](/src/task))
- testing library called `oki` (docs at [`src/oki`](/src/oki))
- codegen by convention called `gen` (docs at [`src/gen`](/src/gen))
- dev server with efficient caching and pluggable compilation
- formatting via [Prettier](https://github.com/prettier/prettier)
- utilities to fill in the gaps for Node and the browser
- more to come, exploring what deeply integrated tools enable
  for developer power, ergonomics, and productivity

## docs

- [unbundled development](/src/docs/unbundledDevelopment.md) for web frontends, servers, and libraries
- [`task`](/src/task) runner
- [`oki`](/src/oki) testing library
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
gro # lists all available tasks with the pattern `*.task.ts`
gro some/dir # lists all tasks inside `src/some/dir`
gro some/file # runs `src/some/file.task.ts`
gro some/file.task.ts # same as above
gro test # run `src/test.task.ts` if it exists, falling back to Gro's builtin
```

Gro has a number of builtin tasks.
To learn more [see the task docs](/src/task)
and [the generated task index](/src/docs/tasks.md).

```bash
gro dev # starts the dev server in watch mode
```

```bash
gro build # builds everything for production
```

Testing with `oki` (docs at [`src/oki`](/src/oki))

```bash
gro test # run all tests for `*.test.ts` files
```

Codegen with `gen` (docs at [`src/gen`](/src/gen))

```bash
gro gen # runs codegen for all `*.gen.*` files
gro gen --check # errors if any generated files are new or different
```

```bash
gro format # formats all of the source files using Prettier
gro format --check # checks that all source files are formatted
```

```bash
gro clean # deletes all build artifacts from the filesystem
```

```bash
gro serve # serves the current directory
gro serve some/dir and/another/dir # serves some directories
```

```bash
gro --version # or `-v` prints the Gro version
```

```bash
gro check # typechecks, runs tests, and ensures generated files are current
gro typecheck # just the typechecking
```

## develop

```bash
npm run bootstrap # builds and links `gro` - needed only once
gro test # make sure everything looks good - same as `npm test`

# development
gro dev # build in watch mode
gro project/dist # update the `gro` CLI

# release
gro project/build # builds for release and updates the `gro` CLI
```

## credits :turtle: <sub>:turtle:</sub><sub><sub>:turtle:</sub></sub>

Gro uses
[Svelte](https://github.com/sveltejs/svelte) ∙
[Rollup](https://github.com/rollup/rollup) ∙
[TypeScript](https://github.com/microsoft/TypeScript) ∙
[swc](https://github.com/swc-project/swc) ∙
[esinstall](https://github.com/snowpackjs/snowpack/tree/main/esinstall) ∙
[Prettier](https://github.com/prettier/prettier) ∙
[Node](https://nodejs.org) & [more](package.json)

Gro's strategy of pairing unbundled ES modules during development
with optimized bundles for production
was inspired by [Snowpack](https://github.com/pikapkg/snowpack).

Gro's buildtime antics were inspired by [Svelte](https://github.com/sveltejs/svelte).

## license :bird:

[MIT](LICENSE)
