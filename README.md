# gro :chestnut:

> opinionated tools for web development

> **_warning!_** You should probably not use Gro today —
> there are many mature tools with large communities solving similar problems.
> Gro integrates several tools into a single experience but
> for now it's unlikely to be the experience that fits your particular needs.

## docs

- [`task`](src/task) runner
- [`oki`](src/oki) testing library
- [`gen`](src/gen) code generation
- other [docs](src/docs)
  - [options](src/docs/options.md)
  - [tasks](src/docs/tasks.md)

## motivation

Gro is an opinionated monotool for making webapps.
It includes:

- [task runner](src/task) that uses the filesystem convention `*.task.ts`
  (docs at [`src/task`](src/task))
- testing library called `oki` (docs at [`src/oki`](src/oki))
- codegen by convention called `gen` (docs at [`src/gen`](src/gen))
- dev server
- fully integrated [TypeScript](https://github.com/microsoft/typescript)
- bundling via [Rollup](https://github.com/rollup/rollup)
- formatting via [Prettier](https://github.com/prettier/prettier)
- integrated UI development with
  [Svelte](https://github.com/sveltejs/svelte)
- more to come, exploring what deeply integrated tools enable
  in the realms of developer power and ergonomics and end user experience

## usage

```bash
gro # lists all available tasks with the pattern `*.task.ts`
gro some/dir # lists all tasks inside `src/some/dir`
gro some/file # runs `src/some/file.task.ts`
gro some/file.task.ts # same as above
gro test # run one of Gro's tasks or `src/test.task.ts` if it exists
```

Gro has a number of builtin tasks.
To learn more [see the task docs](src/task)
and [the generated task index](src/docs/tasks.md).

```bash
gro dev # builds in watch mode and starts a dev server
```

```bash
gro build # build once, defaulting to NODE_ENV=development
```

Testing with `oki` (docs at [`src/oki`](src/oki))

```bash
gro test # run all tests for `*.test.ts` files
```

Codegen with `gen` (docs at [`src/gen`](src/gen))

```bash
gro gen # runs codegen for all `*.gen.*` files
```

```bash
gro serve # staticly serves the current directory (or a configured one)
```

```bash
gro assets # builds static assets (TODO integrate with `gro dev`)
```

```bash
gro clean # remove all build artifacts
```

## credits :turtle: <sub>:turtle:</sub><sub><sub>:turtle:</sub></sub>

tech:
[`svelte`](https://github.com/sveltejs/svelte),
[`rollup`](https://github.com/rollup/rollup),
[`typescript`](https://github.com/microsoft/TypeScript),
[`prettier`](https://github.com/prettier/prettier),
[`node`](https://nodejs.org),
[`github`](https://github.com),
[`git`](https://git-scm.com/)

> :rainbow::sparkles: did you know? `emoji` can be punctuation :snail: neat huh

## license :bird:

[ISC](license)
<sub>permissive <3 [learn more at Wikipedia](https://en.wikipedia.org/wiki/ISC_license)</sub>
