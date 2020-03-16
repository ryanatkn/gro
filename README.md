# gro :chestnut:

> opinionated tools for web development

```ts
// work in progress
```

## motivation

I'm making `gro` to learn and explore while building some webapps.
Its scope is huge - it's an unabashed monotool,
so if an app I'm making needs something reusable
that doesn't obviously deserve its own repo,
`gro` eats it up.
I'm also feeding a bad case of the NIHs
so it's got stacks of reinvented wheels, some with a twist,
and I have starry-eyed plans for cool features that may never materialize.

I don't encourage anyone to use `gro`, because there are
many mature tools with large communities solving similar problems.

I want a web dev monotool that:

- makes me happy
- solves my particular problems with my opinionated solutions
- meets my current definitions of _simple_, _fast_, and _smooth_ (low friction)
- has batteries included but minimal dependencies
- hides complexity but exposes it when needed
- works for many use cases like static sites, SPAs, webapp servers, etc
- provides solutions for things like auth, data fetching and storage, etc
- explores ideas like AOT compilation, codegen, data-driven development, etc,
  pushing complexity towards the tool and away from the runtime and dev
- helps me create and maintain great web things that prioritize UX

## usage

```bash
gro --help
gro dev
```

## contents

- [oki](src/oki/README.md) testing library
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
