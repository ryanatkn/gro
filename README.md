# gro <img src="src/static/favicon.png" width="32" height="32">

<img src="src/static/favicon.png" align="right" width="192" height="192">

> opinionated webdev toolkit 🌰

limitations:

- [Windows is not yet supported](https://github.com/feltjs/gro/issues/319)
- Gro is actively used but has few users,
  so you'll likely find problems and undesirable limitations --
  please open issues!
  - example: there are definitely things that should be configurable that aren't
  - gro wants all source code and assets to be in `src/` or `node_modules/`,
    which may annoy

## about

Gro is an opinionated webdev toolkit
that complements [SvelteKit](https://github.com/sveltejs/kit)
and [Vite](https://github.com/vitejs/vite)
for making web frontends, servers, and libraries.
It includes:

- limited but functional
  [developing](/src/lib/docs/dev.md),
  [building](/src/lib/docs/build.md),
  [testing](/src/lib/docs/test.md),
  [deploying](/src/lib/docs/deploy.md),
  and [publishing](/src/lib/docs/publish.md)
  for [Svelte](https://github.com/sveltejs/svelte)/[SvelteKit](https://github.com/sveltejs/kit)
  apps along with Node servers, JS/TS/Svelte libraries, and other things
  - integrated [TypeScript](https://github.com/microsoft/typescript),
    [Svelte](https://github.com/sveltejs/svelte),
    and [SvelteKit](https://github.com/sveltejs/kit)
  - see the [Gro config docs](/src/lib/docs/config.md) and
    [the default config](https://github.com/feltjs/gro/blob/main/src/lib/config/gro.config.default.ts)
  - [configurable plugins](/src/lib/docs/plugin.md) and [adapters](/src/lib/docs/adapt.md)
    to support SvelteKit, auto-restarting API servers, and other external build processes -
    ideally would use SvelteKit/Vite instead
  - example usage in a starter project:
    [`@feltjs/felt-template`](https://github.com/feltjs/felt-template)
- [task runner](/src/lib/docs/task.md) that uses the filesystem convention `*.task.ts`
  - lots of [common default tasks](/src/lib/docs/tasks.md) that projects can easily override and compose
- [testing](/src/lib/docs/test.md) with [`uvu`](https://github.com/lukeed/uvu)
- codegen by convention with [`gen`](/src/lib/docs/gen.md)
  - includes automatic type generation using [JSON Schema](https://json-schema.org/) and
    [json-schema-to-typescript](https://github.com/bcherny/json-schema-to-typescript)
- linting with [ESLint](https://github.com/eslint/eslint)
  (we also maintain [`@feltjs/eslint-config`](https://github.com/feltjs/eslint-config))
- formatting with [Prettier](https://github.com/prettier/prettier):
  it's not always pretty, but it's always formatted

## docs

- [build](/src/lib/docs/build.md) web frontends, servers, and libraries
  - [unbundled development](/src/lib/docs/dev.md)
  - [config](/src/lib/docs/config.md)
  - [deploy](/src/lib/docs/deploy.md) to a branch, like for GitHub pages
  - [publish](/src/lib/docs/publish.md)
- [`Task`](/src/lib/docs/task.md) runner
  - [tasks](/src/lib/docs/tasks.md) list
- [testing](/src/lib/docs/test.md) with [`uvu`](https://github.com/lukeed/uvu)
- [`gen`](/src/lib/docs/gen.md) code generation
- all [the docs](/src/lib/docs#readme)

## install

> depends on node >= 16.6

Normally you'll want to install Gro as a dev dependency:

```bash
npm i -D @feltjs/gro
```

It's handy to install globally too:

```bash
npm i -g @feltjs/gro
```

## usage

Gro has a task runner that discovers and runs TypeScript modules with the `.task.` subextension.
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

14 tasks in gro/src:

build      build the project
check      check that everything is ready to commit
clean      remove temporary dev and build files, and optionally prune git branches
commit     commit and push to a new branch
deploy     deploy to a branch
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
To learn more [see the task docs](/src/lib/docs/task.md)
and [the generated task index](/src/lib/docs/tasks.md).

```bash
gro dev # start developing in watch mode
gro dev -- vite --port 3003 # forward args by separating sections with --
```

```bash
gro build # build everything for production
```

[Testing](/src/lib/docs/test.md) with [`uvu`](https://github.com/lukeed/uvu):

```bash
gro test # run all tests for `*.test.ts` files with `uvu`
gro test filepattern1 some.test another.test
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

Codegen with [`gen`](/src/lib/docs/gen.md):

```bash
gro gen # run codegen for all `*.gen.*` files
gro gen --check # error if any generated files are new or different
```

To deploy: (also see [`src/lib/docs/deploy.md`](/src/lib/docs/deploy.md))

```bash
gro deploy # build and push to the `deploy` branch
```

To publish: (also see [`src/lib/docs/publish.md`](/src/lib/docs/publish.md))

```bash
gro publish # flush changesets, bump version, publish to npm, and git push
```

Etc:

```bash
gro clean # delete all build artifacts from the filesystem
gro clean --sveltekit --nodemodules --git # also deletes dirs and prunes git branches
gro upgrade excluded-dep-1 excluded-dep-2 # npm updates to the latest everything
```

```bash
gro --version # print the Gro version
```

For more see [`src/lib/docs/task.md`](/src/lib/docs/task.md) and [`src/lib/docs`](/src/lib/docs).

## develop

```bash
npm i
npm run build # build and link `gro` - needed only once
gro build # same as `npm run build` when the `gro` CLI is available
gro test # make sure everything looks good - same as `npm test`
gro test some.test another.test

# use your development version of `gro` locally in another project:
gro build # updates the `gro` CLI, same as `npm run build`
cd ../otherproject
npm link ../gro # from `otherproject/`
gro build # from `../gro` on changes
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
[chokidar](https://github.com/paulmillr/chokidar) ∙
[zod](https://github.com/colinhacks/zod) ∙
[@feltjs/util](https://github.com/feltjs/util) ∙
[ESLint](https://github.com/eslint/eslint) ∙
[Prettier](https://github.com/prettier/prettier) ∙
[svelte-check](https://github.com/sveltejs/language-tools/tree/master/packages/svelte-check) ∙
[JSON Schema](https://json-schema.org/) ∙
[json-schema-to-typescript](https://github.com/bcherny/json-schema-to-typescript) &
[more](package.json)

## license [🐦](https://wikipedia.org/wiki/Free_and_open-source_software)

public domain ⚘ [The Unlicense](license)
