# build

This document describes how to go from `gro build` to live websites and npm packages.

Gro has an [unbundled build system](unbundled.md)
that tries to be flexible for many use cases.
It produces artifacts to `.gro/prob/{build_name}`
that get _adapted_ — to use terminology of SvelteKit —
to the target platforms.

"Target platforms" for Gro includes publishing to npm,
but Gro has a very clear distinction between **deploy** and **publish**:
`gro publish` is for npm and `gro deploy` is for the web.

## adapters

Gro has `Adapter`s inspired by Svelte.
When we run:

```bash
gro build
```

The build process has discrete steps:

1. `Builder`s run and output production artifacts to `.gro/prod/{buildName}` for each build
2. `Adapter`s run and output, umm, anything?
   like SvelteKit frontends, Node libraries, API servers, & more !?

> as we're thinking about them, `Adapter`s should not modify the contents of `.gro/prod/`;
> they take builds as inputs, and without changing them,
> they output whatever you want for as long as you want as messily as you want,
> just no messing with the source, that is forbidden --
> this design lets you run many adapters on one build, which means power and efficiency;
> if you find yourself wanting to modify builds in place, try a `Builder` instead
> (the API probably needs improvements and helpers) open issues if you want to discuss!
