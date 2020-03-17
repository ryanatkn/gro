# gro :chestnut:

> opinionated tools for web development

## motivation

`gro` is an opinionated monotool for making webapps.
It includes:

- a dev server
- a testing library called `oki` (docs at [`src/oki`](src/oki))
- codegen by convention called `gen` (docs at [`src/gen`](src/gen))
- fully integrated [TypeScript](https://github.com/microsoft/typescript)
- bundling via [Rollup](https://github.com/rollup/rollup)
- formatting via [Prettier](https://github.com/prettier/prettier)
- integrated UI development with
  [Svelte](https://github.com/sveltejs/svelte)
- more to come, exploring what deeply integrated tools enable
  in the realms of developer power and ergonomics and end user experience

You should probably not use `gro` today —
there are many mature tools with large communities solving similar problems.
If you're interested in an even deeper take on these problems,
see [Rome](https://github.com/facebookexperimental/rome).
Unlike Rome, `gro` does not provide its own parser, compiler, formatter, etc —
instead `gro` uses existing industry-standard libraries
that have few or zero dependencies
and it focuses on exploring territory like codegen, AOT compilation,
and [model-driven development](https://en.wikipedia.org/wiki/Model-driven_engineering).

## usage

```bash
gro --help # outputs info with all commands
```

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

## docs

- [`oki`](src/oki) testing library
- [`gen`](src/gen) code generation
- other [docs](src/docs)
  - [options](src/docs/options.md)

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
