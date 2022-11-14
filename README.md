# gro <img src="src/static/favicon.png" width="32" height="32">

<img src="src/static/favicon.png" align="right" width="192" height="192">

> opinionated webdev toolkit 🌰

limitations:

- [Windows is not yet supported](https://github.com/feltcoop/gro/issues/319)
- [SvelteKit and Vite integration](/src/docs/sveltekit.md) is incomplete
- Gro is actively used but has few users,
  so you'll likely find problems and undesirable limitations --
  please open issues! or contact us directly
  - example: there are definitely things that should be configurable that aren't
  - gro wants all source code and assets to be in `src/` or `node_modules/`,
    which may annoy some people very much;
    please open issues with your snags and we'll see if we can fix them

## about

Gro is an opinionated webdev toolkit
that complements [SvelteKit](https://github.com/sveltejs/kit)
and [Vite](https://github.com/vitejs/vite)
for making web frontends, servers, and libraries.
It includes:

- limited but functional
  [developing](/src/docs/dev.md),
  [building](/src/docs/build.md),
  [testing](/src/docs/test.md),
  [deploying](/src/docs/deploy.md),
  and [publishing](/src/docs/publish.md)
  for [Svelte](https://github.com/sveltejs/svelte)/[SvelteKit](https://github.com/sveltejs/kit)
  apps along with Node servers, JS/TS/Svelte libraries, and other things
  - integrated [TypeScript](https://github.com/microsoft/typescript),
    [Svelte](https://github.com/sveltejs/svelte),
    and [SvelteKit](https://github.com/sveltejs/kit)
  - see the [SvelteKit integration docs](/src/docs/sveltekit.md),
    the [Gro config docs](/src/docs/config.md), and
    [the default config](https://github.com/feltcoop/gro/blob/main/src/config/gro.config.default.ts)
  - [configurable plugins](/src/docs/plugin.md) and [adapters](/src/docs/adapt.md)
    to support SvelteKit, auto-restarting API servers, and other external build processes
  - example usage in a starter project:
    [`@feltcoop/felt-template`](https://github.com/feltcoop/felt-template)
- [task runner](/src/docs/task.md) that uses the filesystem convention `*.task.ts`
  - lots of [common default tasks](/src/docs/tasks.md) that projects can easily override and compose
- [testing](/src/docs/test.md) with [`uvu`](https://github.com/lukeed/uvu)
- codegen by convention with [`gen`](/src/docs/gen.md)
  - includes automatic type generation using [JSON Schema](https://json-schema.org/) and
    [json-schema-to-typescript](https://github.com/bcherny/json-schema-to-typescript)
- integrated platform-independent [`fs`](/src/fs/filesystem.ts)
  (code is parameterized with an `fs` argument)
  - modeled & implemented with [`fs-extra`](https://github.com/jprichardson/node-fs-extra),
    a drop-in replacement for Node's `fs` with better semantics
  - [memory](/src/fs/memory.ts) implementation works everywhere JS runs
  - TODO more, like: `localStorage`, GitHub repo, generic keyvalue stores, a composition/proxy API
- linting with [ESLint](https://github.com/eslint/eslint)
  (we also maintain [`@feltcoop/eslint-config`](https://github.com/feltcoop/eslint-config))
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
- [`task`](/src/docs/task.md) runner
  - [tasks](/src/docs/tasks.md) list
- [testing](/src/docs/test.md) with [`uvu`](https://github.com/lukeed/uvu)
- [`gen`](/src/docs/gen.md) code generation
- all [the docs](/src/docs#readme)

## install

> depends on node >= 16.6

Normally you'll want to install Gro as a dev dependency:

```bash
npm i -D @feltcoop/gro
```

It's handy to install globally too:

```bash
npm i -g @feltcoop/gro
```

## usage

Gro is a task runner that discovers and runs TypeScript modules with the `.task.` subextension.
Running `gro` with no args prints the tasks
it finds in the current directory along with its default tasks:

```bash
gro # prints available tasks - defers to the project's locally installed version of Gro
```

<details>
<summary>[click to see <code>gro</code> output in an empty project]</summary>

```
Run a task: gro [name]
View help:  gro [name] --help

14 tasks in ./src:

build      build the project
cert       creates a self-signed cert for https with openssl
check      check that everything is ready to commit
clean      remove temporary dev and build files, and optionally prune git branches
deploy     deploy to static hosting
dev        start SvelteKit and other dev plugins
format     format source files
gen        run code generation scripts
help       alias for `gro` with no task name provided
lint       run eslint on the source files
publish    bump version, publish to npm, and git push
test       run tests
typecheck  typecheck the project without emitting any files
upgrade    upgrade deps
```

</details>

Gro matches your CLI input against its filesystem conventions.
It tries to do the right thing, where right is helpful but not surprising,
with some magic but not too much:

```bash
gro # print all available tasks with the pattern `*.task.ts`
gro help # same as `gro`
gro --help # same as `gro`
gro some/dir # list all tasks inside `src/some/dir`
gro some/file # run `src/some/file.task.ts`
gro some/file.task.ts # same as above
gro test # run `src/test.task.ts` if it exists, falling back to Gro's builtin
gro test --help # print info about the "test" task; works for every task
```

Gro has a number of builtin tasks that you can run with the CLI.
To learn more [see the task docs](/src/docs/task.md)
and [the generated task index](/src/docs/tasks.md).

```bash
gro dev # start developing in watch mode
gro dev -- vite --port 3003 # forward args by separating sections with --
```

```bash
gro build # build everything for production
```

[Testing](/src/docs/test.md) with [`uvu`](https://github.com/lukeed/uvu):

```bash
gro test # run all tests for `*.test.ts` files with `uvu`
gro test filepattern1 filepatternB
gro test -- uvu --forwarded_args 'to uvu'
```

Check all the things:

```bash
gro check # does all of the following:
gro typecheck # typecheck JS/TypeScript and Svelte
gro test # run tests
gro gen --check # ensure generated files are current
gro format --check # ensure everything is formatted
gro lint # eslint
```

Formatting with [`prettier`](https://github.com/prettier/prettier):

```bash
gro format # format all of the source files using Prettier
gro format --check # check that all source files are formatted
```

Codegen with [`gen`](/src/docs/gen.md):

```bash
gro gen # run codegen for all `*.gen.*` files
gro gen --check # error if any generated files are new or different
```

To deploy: (also see [`src/docs/deploy.md`](/src/docs/deploy.md))

```bash
gro deploy # build and push to the `deploy` branch
```

To publish: (also see [`src/docs/publish.md`](/src/docs/publish.md))

```bash
gro publish patch # bump version, publish to npm, and git push
gro publish major --and args --are forwarded --to 'npm version'
```

Etc:

```bash
gro clean # delete all build artifacts from the filesystem
gro clean --svelte --nodemodules --git # also deletes dirs and prunes git branches
```

```bash
gro --version # print the Gro version
```

## develop

```bash
npm i
npm run bootstrap # build and link `gro` - needed only once
gro test # make sure everything looks good - same as `npm test`

# development
gro dev # start SvelteKit and other plugins, like API servers; usually you'll keep this running
gro build # update the `gro` CLI locally

# use your development version of `gro` locally in another project
cd ../otherproject
npm link ../gro

# release
gro build # build for release and update the `gro` CLI
```

## credits 🐢<sub>🐢</sub><sub><sub>🐢</sub></sub>

Gro builds on
[TypeScript](https://github.com/microsoft/TypeScript) ∙
[Svelte](https://github.com/sveltejs/svelte) ∙
[SvelteKit](https://github.com/sveltejs/kit) ∙
[Vite](https://github.com/vitejs/vite) ∙
[esbuild](https://github.com/evanw/esbuild) ∙
[uvu](https://github.com/lukeed/uvu) ∙
[mri](https://github.com/lukeed/mri) ∙
[fs-extra](https://github.com/jprichardson/node-fs-extra) ∙
[`@feltcoop/util`](https://github.com/feltcoop/util) ∙
[ESLint](https://github.com/eslint/eslint) ∙
[Prettier](https://github.com/prettier/prettier) ∙
[svelte-check](https://github.com/sveltejs/language-tools/tree/master/packages/svelte-check) ∙
[JSON Schema](https://json-schema.org/) ∙
[json-schema-to-typescript](https://github.com/bcherny/json-schema-to-typescript) &
[more](package.json)

## license [🐦](https://wikipedia.org/wiki/Free_and_open-source_software)

public domain ⚘ [The Unlicense](license)
