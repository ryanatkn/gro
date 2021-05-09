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
