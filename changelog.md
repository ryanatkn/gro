# Gro changelog

## unreleased

- change `gro clean` to delete directories instead of emptying them

## 0.1.5

- add `gro format` and `gro format --check` and format generated code
  ([#8](https://github.com/feltcoop/gro/pull/8))
- add `prettier` and `prettier-plugin-svelte` as peer dependencies and upgrade to Prettier 2
  ([#8](https://github.com/feltcoop/gro/pull/8))

## 0.1.4

- ensure the project has been built when invoking tasks
  ([#5](https://github.com/feltcoop/gro/pull/5))

## 0.1.3

- upgrade TypeScript minor version
- rename `utils/random.ts` functions, expanding "rand" prefix to "random"

## 0.1.2

- upgrade TypeScript dep
- add `utils/createObtainable.ts` for decoupled lifecycle management

## 0.1.1

- add `fs/watchNodeFs.ts` for low level filesystem watching
- expose `remove` and `ensureDir` in `fs/nodeFs.ts`

## 0.1.0

- plant in the ground
