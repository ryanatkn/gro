# @feltjs/gro

## 0.81.2

### Patch Changes

- af8d5e1: prefer project-local changeset command if available

## 0.81.1

### Patch Changes

- edf3214: detect changeset version failure

## 0.81.0

### Minor Changes

- 2daaee0: change gro publish to use changesets

## 0.80.0

- **break**: replace `cheap-watch` with `chokidar` and `fast-glob`
  ([#386](https://github.com/feltjs/gro/pull/386))
- fix `gen` error on startup for projects with no gen modules
  ([#387](https://github.com/feltjs/gro/pull/387))

## 0.79.1

- add `gro commit` task
  ([#379](https://github.com/feltjs/gro/pull/379))
- add `gen` plugin that defaults to watch mode
  ([#283](https://github.com/feltjs/gro/pull/283),
  [#381](https://github.com/feltjs/gro/pull/381))
- add `--reset` and `--origin` flags to `gro deploy`
  ([#383](https://github.com/feltjs/gro/pull/383))

## 0.79.0

- **break**: upgrade to `@feltjs/util@0.9.0` and peer dep `svelte@4`,
  and change peer deps to avoid breaking changes
  ([#378](https://github.com/feltjs/gro/pull/378))

## 0.78.2

- upgrade deps
  ([#377](https://github.com/feltjs/gro/pull/377))

## 0.78.1

- upgrade deps
  ([#376](https://github.com/feltjs/gro/pull/376))

## 0.78.0

- **break**: change schema bundling to use the parsed name in `$defs` instead of the `$id`
  ([commit](https://github.com/feltjs/gro/commit/b5623e2867196823bb146c4794dde035ce6e7fc5))

## 0.77.0

- **break**: move `toJsonSchema` to `$lib/schemaHelpers.ts` and export all of `$lib/schema.ts`
  ([commit](https://github.com/feltjs/gro/commit/21a107633f950ffb540b180b57fc3227146993c5))

## 0.76.1

- upgrade deps
  ([commit](https://github.com/feltjs/gro/commit/538bff4b8f092c0e176fc242cab9da7bfa3f2db9))

## 0.76.0

- **break**: change `toJsonSchema` to not suffix with `.json`, and add the `bundleSchemas` helper
  ([#372](https://github.com/feltjs/gro/pull/372))

## 0.75.5

- upgrade `@ryanatkn/json-schema-to-typescript` dep,
  changing `tsImport` type from `string` to `string | string[]`
  ([commit](https://github.com/feltjs/gro/commit/ff088ae789486fb1348d894078c3a1c2bbb2974a))

## 0.75.4

- export `JsonSchema` type from root
  ([commit](https://github.com/feltjs/gro/commit/8b3956994060165cccf7c0d6b692ea8e89b7e63a))

## 0.75.3

- upgrade deps
  ([#371](https://github.com/feltjs/gro/pull/371))

## 0.75.2

- de-dupe when generating types
  ([commit](https://github.com/feltjs/gro/commit/01d02a17a5b050b63d7699371e559802fed6407d))

## 0.75.1

- export `toGenContextImports` from `lib/runGen`
  ([commit](https://github.com/feltjs/gro/commit/980f75bf43f77cb3107b446c079cc401c88b3f94))

## 0.75.0

- **break**: change schema type generation to infer `tsType` and `tsImport` from `$ref` and `instanceof`
  ([#370](https://github.com/feltjs/gro/pull/370))
- **break**: bump peer dep `svelte@0.58.0`
  ([#370](https://github.com/feltjs/gro/pull/370))

## 0.74.0

- **break**: fix schema type generation to be shallow, excluding the types of referenced schemas
  ([#367](https://github.com/feltjs/gro/pull/367))

## 0.73.0

- **break**: upgrade dep `@feltjs/util@0.8.0` and `esbuild@0.17.0`
  ([#366](https://github.com/feltjs/gro/pull/366))
- `npm i` before `gro build`, add `--no-install` flag to override
  ([#365](https://github.com/feltjs/gro/pull/365))

## 0.72.0

- **break**: upgrade dep `@feltjs/util@0.7.4`
  ([commit](https://github.com/feltjs/gro/commit/731007d1533f981e524e318c00af3a6fa861e909))

## 0.71.0

- **break**: upgrade dep `@feltjs/util@0.6.0`
  ([#364](https://github.com/feltjs/gro/pull/364))

## 0.70.5

- quieter logging

## 0.70.4

- bump package-lock version to 3after npm upgrade

## 0.70.3

- upgrade `@feltjs/util`
  ([#362](https://github.com/feltjs/gro/pull/362))

## 0.70.2

- fix production types for builds that don't specify a value
  ([#363](https://github.com/feltjs/gro/pull/363))
- undo adding TypeScript as a peer dependency

## 0.70.1

- add TypeScript as a peer dependency

## 0.70.0

- **break**: remove `tsconfig` arg from `gro typecheck` since `svelte-check` 3 no longer needs it
  ([#360](https://github.com/feltjs/gro/pull/360))
- **break**: move the SvelteKit build instead of copying it
  ([5719273](https://github.com/feltjs/gro/commit/5719273aba7b3634fdd6c4f8a6d4714a1512b8d4))

## 0.69.0

- **break**: upgrade deps including SvelteKit 1.0
  ([#359](https://github.com/feltjs/gro/pull/359))

## 0.68.2

- relax the type of `RawGenResult` to let the array have any value
  ([6faf95b](https://github.com/feltjs/gro/commit/6faf95b36bc0769aee45d0c96454a445ebb8485c))

## 0.68.1

- relax the type of `RawGenResult` to include an ignored `null`
  ([a8cf511](https://github.com/feltjs/gro/commit/a8cf51129ff53a4d8257c1f2e728aee2ffd7f2ac))

## 0.68.0

- **break**: move `types` from the main config to the build config
  ([#358](https://github.com/feltjs/gro/pull/358))

## 0.67.3

- add `svelte` property of published `package.json`
- upgrade deps

## 0.67.2

- remove `readonly` from `BuildConfigInput[]` usage

## 0.67.1

- fix `$app/environment` `dev` import

## 0.67.0

- upgrade `@feltjs/util@0.3.0`

## 0.66.1

- fix imports

## 0.66.0

- **break**: upgrade `@feltjs/util`
  ([#356](https://github.com/feltjs/gro/pull/356))

## 0.65.0

- **break**: depend on `@feltjs/util` instead of `@feltjs/felt-ui`
  ([#355](https://github.com/feltjs/gro/pull/355))

## 0.64.0

- **break**: upgrade peer dep `@feltjs/felt-ui@0.42.0`
  ([#354](https://github.com/feltjs/gro/pull/354))

## 0.63.2

- call `svelte-kit sync` only if it's installed
  ([#353](https://github.com/feltjs/gro/pull/353))

## 0.63.1

- pass `--skipLibCheck` to `tsc` on `gro build` so it can be disabled in dependents' tsconfigs
  ([#352](https://github.com/feltjs/gro/pull/352))
- always run `svelte-kit sync` instead of checking for the directory first
  ([#352](https://github.com/feltjs/gro/pull/352))

## 0.63.0

- **break**: change `src/gro.config.ts` to export a default value instead of a `config` property
  ([#348](https://github.com/feltjs/gro/pull/348))
- **break**: change `plugin/gro-plugin-api-server.ts` to a no-op outside of dev mode
  ([#347](https://github.com/feltjs/gro/pull/347))
- fix `gro deploy` for unfetched branches
  ([#350](https://github.com/feltjs/gro/pull/350))
- upgrade deps
  ([#351](https://github.com/feltjs/gro/pull/351))

## 0.62.4

- skip `gro test` if `uvu` is not installed, and log a warning
  ([#346](https://github.com/feltjs/gro/pull/346))

## 0.62.3

- do not run `tsc` in `gro check` if `svelte-check` is available
  ([#345](https://github.com/feltjs/gro/pull/345))

## 0.62.2

- fix task arg definitions

## 0.62.1

- upgrade deps
  ([#342](https://github.com/feltjs/gro/pull/342))
- use [zod](https://github.com/colinhacks/zod) for task schemas
  ([#344](https://github.com/feltjs/gro/pull/344))

## 0.62.0

- **break**: upgrade deps
  ([#341](https://github.com/feltjs/gro/pull/341))
- respect the `types` config property for Svelte files
  ([#341](https://github.com/feltjs/gro/pull/341))

## 0.61.3

- fix type parsing for Svelte files
  ([#340](https://github.com/feltjs/gro/pull/340))

## 0.61.2

- change `gro typecheck` to always run both `tsc` and `svelte-check`
  instead of stopping when `tsc` finds an error
  ([#339](https://github.com/feltjs/gro/pull/339))

## 0.61.1

- upgrade SvelteKit import mocks
  ([#338](https://github.com/feltjs/gro/pull/338))

## 0.61.0

- **break**: upgrade deps and remove peer deps for `@sveltejs/kit`, `uvu`, and `typescript`
  ([#337](https://github.com/feltjs/gro/pull/337))

## 0.60.2

- fix `gro deploy` when the deployment branch isn't loaded locally
  ([#336](https://github.com/feltjs/gro/pull/336))

## 0.60.1

- add exclude functionality to the upgrade task: `gro upgrade foo bar`
  ([#335](https://github.com/feltjs/gro/pull/335))

## 0.60.0

- **break**: upgrade deps
  ([#334](https://github.com/feltjs/gro/pull/334))
- add upgrade task
  ([#334](https://github.com/feltjs/gro/pull/334))

## 0.59.0

- **break**: upgrade deps
  ([#332](https://github.com/feltjs/gro/pull/332))

## 0.58.0

- **break**: upgrade deps
  ([#331](https://github.com/feltjs/gro/pull/331))

## 0.57.0

- **break**: upgrade deps
  ([#330](https://github.com/feltjs/gro/pull/330))

## 0.56.0

- **break**: rename adapter and plugin modules to use dash-case
  ([#327](https://github.com/feltjs/gro/pull/327))
- upgrade some deps
  ([#326](https://github.com/feltjs/gro/pull/326))

## 0.55.2

- build only the included TypeScript files to `dist/src/`
  ([#325](https://github.com/feltjs/gro/pull/325))

## 0.55.1

- add `format` option to gen files, defaults to `true`
  ([#324](https://github.com/feltjs/gro/pull/324))

## 0.55.0

- **break**: remove the dev server, including `gro serve` and project metadata
  ([#321](https://github.com/feltjs/gro/pull/321))
- always build before running tasks
  ([#322](https://github.com/feltjs/gro/pull/322))

## 0.54.0

- **break**: upgrade deps including peer dep for `@feltjs/felt-ui@0.26.0`
  ([#320](https://github.com/feltjs/gro/pull/320))
- **break**: remove `deploymentMode` option from SvelteKit frontend adapter
  ([#320](https://github.com/feltjs/gro/pull/320))

## 0.53.0

- **break**: upgrade `@sveltejs/kit@1.0.0-next.298` and run `svelte-kit sync` before typechecking
  ([#317](https://github.com/feltjs/gro/pull/317))

## 0.52.3

- register schemas for gen and search for them before the file resolver
  ([#316](https://github.com/feltjs/gro/pull/316))

## 0.52.2

- improve safety of `gro deploy` and update its docs
  ([#315](https://github.com/feltjs/gro/pull/315))

## 0.52.1

- fix args type for `invoke_task`
  ([#314](https://github.com/feltjs/gro/pull/314))

## 0.52.0

- **break**: validate task `args` from schemas,
  setting defaults automatically and disallowing additional properties
  ([#313](https://github.com/feltjs/gro/pull/313))
- **break**: change `invoke_task` to no longer forward `args` automatically
  ([#313](https://github.com/feltjs/gro/pull/313))
- **break**: add generic agnostic command args forwarding
  [using the `--` pattern](src/lib/docs/task.md#task-args-forwarding)
  ([#313](https://github.com/feltjs/gro/pull/313))
- **break**: remove `-v` alias for `gro --version`
  ([#313](https://github.com/feltjs/gro/pull/313))

## 0.51.3

- fix task name printing for task directories
  ([#312](https://github.com/feltjs/gro/pull/312))

## 0.51.2

- support task dirs
  ([#311](https://github.com/feltjs/gro/pull/311))

## 0.51.1

- fix value printing in args logging
  ([#310](https://github.com/feltjs/gro/pull/310))

## 0.51.0

- **break**: rename the `gro publish` `branch` arg to `source` and add `target` branch arg
  ([#306](https://github.com/feltjs/gro/pull/306))
- **break**: move `mapBundleOptions` from args to the Node library adapter options
  ([#306](https://github.com/feltjs/gro/pull/306))
- add schema information to task args
  ([#306](https://github.com/feltjs/gro/pull/306))
- add `--help` flag to `gro` and `gro taskname`, along with `gro help` alias
  ([#306](https://github.com/feltjs/gro/pull/306), [#307](https://github.com/feltjs/gro/pull/307))
- combine imports in generated schema types
  ([#304](https://github.com/feltjs/gro/pull/304))
- add CLI opt-outs to `gro check` for `no-typecheck`, `no-test`, `no-gen`, `no-format`, & `no-lint`
  ([#305](https://github.com/feltjs/gro/pull/305))
- fix inline type parsing to include type dependencies
  ([#308](https://github.com/feltjs/gro/pull/308))

## 0.50.5

- make `gro check` fail on lint warnings
  ([#302](https://github.com/feltjs/gro/pull/302))
- pass through args in `gro lint` to `eslint`
  ([#302](https://github.com/feltjs/gro/pull/302))

## 0.50.4

- run `eslint` in `gro check` if it's available
  ([#301](https://github.com/feltjs/gro/pull/301))

## 0.50.3

- fix default config to build types only for production
  ([#300](https://github.com/feltjs/gro/pull/300))

## 0.50.2

- add `.schema.` files to system build
  ([#299](https://github.com/feltjs/gro/pull/299))

## 0.50.1

- add `gro gen` support for `.schema.` files with automatically generated types
  ([#298](https://github.com/feltjs/gro/pull/298))

## 0.50.0

- **break**: upgrade `@feltjs/felt-ui@0.18.0`
  ([#297](https://github.com/feltjs/gro/pull/297))

## 0.49.0

- **break**: remove `svelte-check` as a dependency,
  but still call it in `gro typecheck` if installed
  ([#296](https://github.com/feltjs/gro/pull/296))

## 0.48.0

- **break**: remove Rollup and its plugins as a dependency, and use esbuild for bundling instead;
  this changes the Node library adapter interface to use `mapBundleOptions`
  and removes the Rollup mapping functions
  ([#295](https://github.com/feltjs/gro/pull/295))

## 0.47.5

- mock SvelteKit imports like `'$app/navigation'` for tests
  ([#294](https://github.com/feltjs/gro/pull/294))

## 0.47.4

- fix 404 page for GitHub pages with SvelteKit adapter
  ([#293](https://github.com/feltjs/gro/pull/293))

## 0.47.3

- make the `throttle` cache key optional
  ([#290](https://github.com/feltjs/gro/pull/290))
- attempt to fix deps broken by [#286](https://github.com/feltjs/gro/pull/286)
  ([#291](https://github.com/feltjs/gro/pull/291))

## 0.47.2

- fix bug with the `throttle` `delay` option
  ([#289](https://github.com/feltjs/gro/pull/289))

## 0.47.1

- fix `svelte-check` to scope to `src/`
  ([#273](https://github.com/feltjs/gro/pull/273))
- fix writing source meta concurrently
  ([#288](https://github.com/feltjs/gro/pull/288))
- add `util/throttle.ts`
  ([#288](https://github.com/feltjs/gro/pull/288))

## 0.47.0

- **break**: update deps
  ([#286](https://github.com/feltjs/gro/pull/286))

## 0.46.0

- **break**: change task `dev` property to `production`
  ([#284](https://github.com/feltjs/gro/pull/284))
- fix `process.env.NODE_ENV` for production tasks
  ([#284](https://github.com/feltjs/gro/pull/284),
  [#287](https://github.com/feltjs/gro/pull/287))

## 0.45.2

- clean dist for production builds
  ([#285](https://github.com/feltjs/gro/pull/285))

## 0.45.1

- fix peer dependency versions
  ([#282](https://github.com/feltjs/gro/pull/282))

## 0.45.0

- **break**: remove frontend build support in favor of SvelteKit
  ([#281](https://github.com/feltjs/gro/pull/281))

## 0.44.3

- process `.js` files with the esbuild builder
  ([#280](https://github.com/feltjs/gro/pull/280))

## 0.44.2

- add optional `paths` to `Filer` and improve its tests
  ([#276](https://github.com/feltjs/gro/pull/276))
- make `gro test` ignore sourcemap files by default so patterns don't need `.js$`
  ([#277](https://github.com/feltjs/gro/pull/277))
- make `gro gen` build before running
  ([#279](https://github.com/feltjs/gro/pull/279))

## 0.44.1

- change default config to not run the api server during build
  ([#275](https://github.com/feltjs/gro/pull/275))

## 0.44.0

- **break**: upgrade `@feltjs/felt-ui@0.13.0` and make it a peer dependency
  ([#274](https://github.com/feltjs/gro/pull/274))

## 0.43.0

- **break**: upgrade `@feltjs/felt-ui@0.12.0` and `rollup@2.57.0`
  ([#272](https://github.com/feltjs/gro/pull/272))

## 0.42.0

- **break**: add `svelte-check` and typecheck Svelte files in `gro typecheck` and `gro check`
  ([#271](https://github.com/feltjs/gro/pull/271))

## 0.41.1

- support js imports
  ([#270](https://github.com/feltjs/gro/pull/270))

## 0.41.0

- **break**: update deps and remove most peer deps
  ([#269](https://github.com/feltjs/gro/pull/269))
- make `gro deploy` safer by excluding branches `'main'` and `'master'` unless `--force`
  ([#268](https://github.com/feltjs/gro/pull/268))

## 0.40.0

- rename to `camelCase` from `snake_case`
  ([#267](https://github.com/feltjs/gro/pull/267))

## 0.39.1

- fix dev server plugin defaults to not load for prod builds
  ([#265](https://github.com/feltjs/gro/pull/265))

## 0.39.0

- **break**: rename to `PascalCase` from `Proper_Snake_Case`
  ([#263](https://github.com/feltjs/gro/pull/263),
  [#264](https://github.com/feltjs/gro/pull/264))

## 0.38.0

- **break**: require Node >=16.6.0
  ([#262](https://github.com/feltjs/gro/pull/262))

## 0.37.0

- **break**: remove `main_test` config option and behavior
  ([#261](https://github.com/feltjs/gro/pull/261))

## 0.36.1

- add some convenience peer dependencies like `@types/source-map-support` --
  is this a good idea?
  ([#260](https://github.com/feltjs/gro/pull/260))

## 0.36.0

- **break**: fix test sourcemaps by adding
  [`GroConfig` option `main_test`](src/lib/docs/config.md#main_test),
  which initializes projects with a conventional `lib/main.test.ts`
  for installing sourcemaps and other global test concerns (update: reverted in 0.37.0)
  ([#259](https://github.com/feltjs/gro/pull/259))
- add some peer deps
  ([#259](https://github.com/feltjs/gro/pull/259))

## 0.35.0

- **break**: remove dev task event `dev.create_server` and add `dev.create_context`
  ([#258](https://github.com/feltjs/gro/pull/258))
- make the dev server a plugin
  ([#258](https://github.com/feltjs/gro/pull/258))

## 0.34.3

- clean during `gro build` except when invoked by `gro publish` and `gro deploy`
  ([#255](https://github.com/feltjs/gro/pull/255))

## 0.34.2

- forward args to `svelte-kit dev` and `svelte-kit build`
  ([#254](https://github.com/feltjs/gro/pull/254))
- improve type matcher regexp
  ([#253](https://github.com/feltjs/gro/pull/253))

## 0.34.1

- fix type publishing
  ([#252](https://github.com/feltjs/gro/pull/252))

## 0.34.0

- **break**: remove `cjs` and `esm` options from `gro_adapter_node_library`;
  for now only ESM is supported, to be revisited when we support package exports;
  in the meantime users can fork the adapter for commonjs outputs
  ([#251](https://github.com/feltjs/gro/pull/251))
- **break**: disallow running some tasks in development: `gro build`, `gro deploy`, `gro publish`
  ([#251](https://github.com/feltjs/gro/pull/251))
- rename `src/lib/adapt/adapt.ts` module and improve docs for `adapt` and `plugin`
  ([#250](https://github.com/feltjs/gro/pull/250))

## 0.33.1

- fix `gro_adapter_gro_frontend` by prebundling externals only in development
  ([#249](https://github.com/feltjs/gro/pull/249))
- upgrade `es-module-lexer@0.7.1`
  ([#248](https://github.com/feltjs/gro/pull/248))

## 0.33.0

- **break**: refactor `postprocess` into builders and delete `Build` and `Build_Result`
  ([#243](https://github.com/feltjs/gro/pull/243))
- **break**: rename builders and builder util
  ([#244](https://github.com/feltjs/gro/pull/244))
- **break**: merge `fs/path_filter.ts` and `fs/file.ts` into `fs/filter.ts`,
  rename `Id_Filter` from `File_Filter`, and add `Id_Stats_Filter`
  ([#246](https://github.com/feltjs/gro/pull/246))
- support JSON imports
  ([#245](https://github.com/feltjs/gro/pull/245))
- ignore unwanted assets in frontend build
  ([#242](https://github.com/feltjs/gro/pull/242),
  [#246](https://github.com/feltjs/gro/pull/246))

## 0.32.1

- change `gro deploy` to infer default `dirname`
  ([#241](https://github.com/feltjs/gro/pull/241))

## 0.32.0

- **break**: add `gro_adapter_gro_frontend` adapter
  ([#231](https://github.com/feltjs/gro/pull/231))

## 0.31.0

- **break**: change `gro_adapter_node_library` option `type` to boolean `bundle`
  ([#239](https://github.com/feltjs/gro/pull/239))
- support outputting Svelte source files in production builds
  ([#239](https://github.com/feltjs/gro/pull/239))

## 0.30.3

- fix dynamic import parsing to allow non-interpolated template string literals
  ([#238](https://github.com/feltjs/gro/pull/238))

## 0.30.2

- fix import parsing to ignore non-literal dynamic imports
  ([#237](https://github.com/feltjs/gro/pull/237))

## 0.30.1

- fix conversion of absolute specifiers to include `./` if bare
  ([#236](https://github.com/feltjs/gro/pull/236))
- upgrade to esbuild@0.12.15
  ([#235](https://github.com/feltjs/gro/pull/235))

## 0.30.0

- **break**: change default server to `src/lib/server/server.ts` from `src/server/server.ts`
  ([#234](https://github.com/feltjs/gro/pull/234))

## 0.29.0

- **break**: rename plugins, adapters, and builders to `snake_case` from `kebab-case`
  ([#232](https://github.com/feltjs/gro/pull/232))
- update deps
  ([#233](https://github.com/feltjs/gro/pull/233))

## 0.28.3

- add Gro frontend support with `gro_adapter_gro_frontend`
  ([#231](https://github.com/feltjs/gro/pull/231))
- fix buildless builds to handle SvelteKit-only frontend projects
  ([#230](https://github.com/feltjs/gro/pull/230))

## 0.28.2

- upgrade to `@feltjs/felt-ui@0.3.0`
  ([#229](https://github.com/feltjs/gro/pull/229))

## 0.28.1

- fix library adapter `package.json` paths
  ([#228](https://github.com/feltjs/gro/pull/228))

## 0.28.0

- **break**: remove `gro start` task
  ([#223](https://github.com/feltjs/gro/pull/223))
- add `Plugin`s and `config.plugin` to support SvelteKit and API servers
  ([#223](https://github.com/feltjs/gro/pull/223),
  [#224](https://github.com/feltjs/gro/pull/224))
- implement API server config and adapter
  ([#223](https://github.com/feltjs/gro/pull/223))
- implement library adapter
  ([#226](https://github.com/feltjs/gro/pull/226),
  [#227](https://github.com/feltjs/gro/pull/227))

## 0.27.3

- fix default library build to include types in production
  ([#222](https://github.com/feltjs/gro/pull/222))

## 0.27.2

- fix deploy task
  ([#221](https://github.com/feltjs/gro/pull/221))

## 0.27.1

- support absolute path imports `$lib/` and `src/`
  ([#153](https://github.com/feltjs/gro/pull/153))
- infer `npm link` in Node library adapter
  ([#218](https://github.com/feltjs/gro/pull/218))
- fix build config validation and normalization
  ([#220](https://github.com/feltjs/gro/pull/220))

## 0.27.0

- **break**: convert to `snake_case` from `camelCase`
  ([#210](https://github.com/feltjs/gro/pull/210))
- **break**: rename `'system'` build from `'node'`
  ([#207](https://github.com/feltjs/gro/pull/207))
- **break**: add `'config'` build to simplify internals
  ([#207](https://github.com/feltjs/gro/pull/207),
  [#212](https://github.com/feltjs/gro/pull/212))
- **break**: build configs now fail to validate if any input path strings do not exist
  ([#207](https://github.com/feltjs/gro/pull/207))
- **break**: rename `load_config` from `loadGro_Config`
  ([#207](https://github.com/feltjs/gro/pull/207))
- **break**: change `validate_build_configs` function signature
  ([#207](https://github.com/feltjs/gro/pull/207))
- **break**: change `gro_adapter_sveltekit_frontend` output so it composes with others
  ([#207](https://github.com/feltjs/gro/pull/207))
- **break**: rename the `Task` `summary` property from `description`
  ([#212](https://github.com/feltjs/gro/pull/212))
- **break**: rename `content` from `contents`
  ([#216](https://github.com/feltjs/gro/pull/216))
- add `no-watch` arg to `gro dev`
  ([#211](https://github.com/feltjs/gro/pull/211))
- rename some args in `gro dev` and `gro serve`
  ([#211](https://github.com/feltjs/gro/pull/211))
- optimize writing source meta to disk
  ([#214](https://github.com/feltjs/gro/pull/214))
- add `typemap` option to Gro config
  ([#215](https://github.com/feltjs/gro/pull/215))
- add `types` option to Gro config
  ([#215](https://github.com/feltjs/gro/pull/215))

## 0.26.2

- support publishing library builds
  ([#209](https://github.com/feltjs/gro/pull/209))
- fix typemaps for production builds
  ([#209](https://github.com/feltjs/gro/pull/209))

## 0.26.1

- rename default `'library'` build from `'lib'`
  ([#208](https://github.com/feltjs/gro/pull/208))

## 0.26.0

- **break**: move util to `@feltjs/felt-ui` and add it as a dependency
  ([#206](https://github.com/feltjs/gro/pull/206))

## 0.25.2

- properly detect unclean git state for `gro deploy`
  ([#205](https://github.com/feltjs/gro/pull/205))

## 0.25.1

- add `.nojekyll` support to frontend adapters for GitHub Pages compatibility
  ([#204](https://github.com/feltjs/gro/pull/204))

## 0.25.0

- **break**: upgrade to latest SvelteKit, changing the dir `.svelte` to `.svelte-kit`
  ([#202](https://github.com/feltjs/gro/pull/202))
- add SvelteKit frontend adapter
  ([#193](https://github.com/feltjs/gro/pull/193))
- fix `gro deploy`
  ([#193](https://github.com/feltjs/gro/pull/193))

## 0.24.1

- separate source meta for dev and prod
  ([#201](https://github.com/feltjs/gro/pull/201))

## 0.24.0

- **break**: extend config with detected defaults
  ([#199](https://github.com/feltjs/gro/pull/199))
- improve `gro publish` errors and suport restricted packages
  ([#199](https://github.com/feltjs/gro/pull/199))

## 0.23.7

- fix `gro publish` arg forwarding to `npm version`
  ([#200](https://github.com/feltjs/gro/pull/200))
- fix `gro publish` to initialize scoped packages
  ([#200](https://github.com/feltjs/gro/pull/200))

## 0.23.6

- tweak publish steps to handle failure better

## 0.23.5

- tweak publishing errors

## 0.23.4

- fix typemap source path
  ([#198](https://github.com/feltjs/gro/pull/198))
- improve publishing changelog UX
  ([#197](https://github.com/feltjs/gro/pull/197))

## 0.23.3

- generate types for bundled production builds
  ([#196](https://github.com/feltjs/gro/pull/196))

## 0.23.2

- generate types for production builds
  ([#194](https://github.com/feltjs/gro/pull/194),
  [#195](https://github.com/feltjs/gro/pull/195))

## 0.23.1

- fix arg forwarding
  ([#191](https://github.com/feltjs/gro/pull/191),
  [#192](https://github.com/feltjs/gro/pull/192))
- fix `gro test` in production, also fixing `gro publish`
  ([#192](https://github.com/feltjs/gro/pull/192))

## 0.23.0

- **break**: rename `gro publish` from `gro version` and improve its safety
  ([#189](https://github.com/feltjs/gro/pull/189))
- make `config.builds` optional and accept non-array values
  ([#189](https://github.com/feltjs/gro/pull/189))
- document more about `adapt`
  ([#189](https://github.com/feltjs/gro/pull/189))

## 0.22.0

- **break**: redesign `gro publish` and `gro deploy`
  ([#187](https://github.com/feltjs/gro/pull/187))
- **break**: add [`Adapter` system](/src/lib/docs/adapt.md) and
  [Node library adapter](/src/lib/adapt/gro_adapter_node_library.ts)
  ([#187](https://github.com/feltjs/gro/pull/187))
- **break**: add a default `"node"` build named `"node"` if one is not defined
  ([#187](https://github.com/feltjs/gro/pull/187))
- **break**: rename `toObtainable` from `createObtainable`
  ([#187](https://github.com/feltjs/gro/pull/187))
- **break**: rename `Filesystem.write_file` from `outputFile`
  ([#188](https://github.com/feltjs/gro/pull/188))
- **break**: upgrade to `fs-extra@10.0.0`
  ([#188](https://github.com/feltjs/gro/pull/188))

## 0.21.6

- hack: add temporary support for extensionless import paths to internal modules
  ([#186](https://github.com/feltjs/gro/pull/186))

## 0.21.5

- export config types and helpers from root
  ([#185](https://github.com/feltjs/gro/pull/185))

## 0.21.4

- export `UnreachableError` and time util from root
  ([#184](https://github.com/feltjs/gro/pull/184))

## 0.21.3

- force push on `gro deploy`
  ([#183](https://github.com/feltjs/gro/pull/183))

## 0.21.2

- ignore error on failed `git pull` during `gro deploy`
  ([#182](https://github.com/feltjs/gro/pull/182))

## 0.21.1

- change `gro gen` to handle failed formatting gracefully
  ([#181](https://github.com/feltjs/gro/pull/181))

## 0.21.0

- **break**: change `gro clean` args to longhand and
  add option `--git` to prune dead branches
  ([#180](https://github.com/feltjs/gro/pull/180))
- fix `gro build` to copy files to `dist/` with `src/lib/build/dist.ts` helper `copy_dist`
  ([#179](https://github.com/feltjs/gro/pull/179))

## 0.20.4

- fix `gro deploy` to first pull the remote deploy branch
  ([#178](https://github.com/feltjs/gro/pull/178))

## 0.20.3

- fix production builds
  ([#177](https://github.com/feltjs/gro/pull/177))

## 0.20.2

- refactor Gro's production build
  ([#176](https://github.com/feltjs/gro/pull/176))

## 0.20.1

- upgrade to npm 7 and its v2 lockfile
  ([#174](https://github.com/feltjs/gro/pull/174),
  [#175](https://github.com/feltjs/gro/pull/175))

## 0.20.0

- **break**: rework the `Filesystem` interfaces
  ([#173](https://github.com/feltjs/gro/pull/173))
  - export a `fs` instance from each `Filesystem` implementation
    and do not export individual functions
  - rename `pathExists` to `exists`
  - remove `readJson`
- add abstract class `Fs` and implement `Memory_Fs`
  to complement the `fs-extra` implementation at `src/lib/fs/node.ts`
  ([#173](https://github.com/feltjs/gro/pull/173))

## 0.19.0

- **break**: extract the `Filesystem` interface and
  thread it everywhere from `src/lib/cli/invoke.ts` and tests
  ([#171](https://github.com/feltjs/gro/pull/171))
- **break**: replace `src/lib/util/gitignore.ts` helper `is_gitignored`
  with `src/lib/fs/path_filter.ts` helper `to_path_filter`
  ([#172](https://github.com/feltjs/gro/pull/172))

## 0.18.2

- fix `gro start` task to serve static builds to port 3000 like the others
  ([#170](https://github.com/feltjs/gro/pull/170))

## 0.18.1

- fix `gro start` task to work with SvelteKit and the API server if detected
  ([#169](https://github.com/feltjs/gro/pull/169))

## 0.18.0

- **break**: change the interface of `gro dev` and `gro build` to support the API server
  ([#168](https://github.com/feltjs/gro/pull/168))

## 0.17.1

- fix `gro format` to whitelist files off root when formatting `src/`
  ([#166](https://github.com/feltjs/gro/pull/166))
- fix `gro test` to gracefully handle projects with no Gro build outputs
  ([#167](https://github.com/feltjs/gro/pull/167))
- run `gro check` before building in `gro version`
  ([#167](https://github.com/feltjs/gro/pull/167))

## 0.17.0

- **break**: rename `src/lib/util/equal.ts` module from `deepEqual.ts`
  ([#162](https://github.com/feltjs/gro/pull/162))
- **break**: rename `Gro_Config_Partial` from `PartialGro_Config`
  and `Build_Config_Partial` from `PartialBuild_Config`
  ([#164](https://github.com/feltjs/gro/pull/164))
- make serve task work for production SvelteKit builds
  ([#163](https://github.com/feltjs/gro/pull/163))
- add `src/lib/util/gitignore.ts` with `is_gitignored` and `load_gitignore_filter`
  ([#165](https://github.com/feltjs/gro/pull/165))
- add helper `to_sveltekit_base_path` to `src/lib/build/sveltekit_helpers.ts`
  ([#163](https://github.com/feltjs/gro/pull/163))
- default to some environment variables
  for undefined Gro config properties:
  `GRO_HOST`, `GRO_PORT`, `GRO_LOG_LEVEL`
  ([#162](https://github.com/feltjs/gro/pull/162))
- export the logger API from root and fix it
  ([#162](https://github.com/feltjs/gro/pull/162))

## 0.16.0

- **break**: rename some paths constants for consistency
  ([#161](https://github.com/feltjs/gro/pull/161))
- patch SvelteKit bug with duplicate build directories
  ([#160](https://github.com/feltjs/gro/pull/160))
- add [contributing.md🌄](./contributing.md)
  ([#108](https://github.com/feltjs/gro/pull/108))

## 0.15.0

- **break**: make `src/lib/build.task.ts`, `src/deploy.task.ts`,
  and `src/start.task.ts` work with SvelteKit
  ([#157](https://github.com/feltjs/gro/pull/157),
  [#159](https://github.com/feltjs/gro/pull/159))
  - add flag `gro deploy --clean` to reset deployment state
  - add flag `--branch` to both tasks, default to `main`
  - default to the `deploy` branch instead of `gh-pages`
- **break**: rename `to_env_string` and `to_env_number` from `stringFromEnv` and `numberFromEnv`
  ([#158](https://github.com/feltjs/gro/pull/158))
- add helper `read_dir` to `src/lib/fs/node.ts`
  ([#159](https://github.com/feltjs/gro/pull/159))

## 0.14.0

- **break**: rename `src/lib/fs/node.ts` from `src/lib/fs/nodeFs.ts`
  ([#154](https://github.com/feltjs/gro/pull/154))
- **break**: rename `src/lib/fs/clean.ts` from `src/lib/util/clean.ts`
  ([#155](https://github.com/feltjs/gro/pull/155))
- **break**: rename `to_array` from `ensureArray`
  ([#117](https://github.com/feltjs/gro/pull/117))
- upgrade to `svelte@3.37.0`
  ([#102](https://github.com/feltjs/gro/pull/102))
- fix `dist/` build
  ([#156](https://github.com/feltjs/gro/pull/156))
- export many more things from root: `import {/* !!! */} from '@feltjs/gro';`
  ([#117](https://github.com/feltjs/gro/pull/117))
- improve logging readability
  ([#152](https://github.com/feltjs/gro/pull/152))

## 0.13.0

- **break**: require Node >=14.16.0
  ([#150](https://github.com/feltjs/gro/pull/150))
- fix false positive API server detection in default config
  ([#151](https://github.com/feltjs/gro/pull/151))
- add `get_mime_types` and `get_extensions` returning iterators to `src/lib/fs/mime.ts`
  ([#149](https://github.com/feltjs/gro/pull/149))
- improve default asset paths to use registered mime types
  ([#149](https://github.com/feltjs/gro/pull/149))

## 0.12.1

- fix swapped API server ports
  ([#148](https://github.com/feltjs/gro/pull/148))

## 0.12.0

- **break**: output builds to `dist/` mirroring the source tree as much as possible
  ([#147](https://github.com/feltjs/gro/pull/147))
- **break**: rename some things around the API server
  ([#147](https://github.com/feltjs/gro/pull/147))
- add `gro start` as an alias for `npm start`
  ([#147](https://github.com/feltjs/gro/pull/147))
- integrate the default Gro API server with SvelteKit and Gro's build task
  ([#145](https://github.com/feltjs/gro/pull/145))
- add task `gro server` to support the default API server use case in SvelteKit
  ([#145](https://github.com/feltjs/gro/pull/145))
- remove the `gro dist` task; it's now part of `gro build`
  ([#146](https://github.com/feltjs/gro/pull/146))

## 0.11.3

- add `events` to `Task_Context` and its generic type to `Task`,
  so tasks can communicate with each other using a normal Node `EventEmitter`
  ([#143](https://github.com/feltjs/gro/pull/143))
  - events aren't great for everything;
    this PR also documents a value mapping pattern convention for tasks in `src/lib/task/README.md`
- `gro build` now correctly builds only `Build_Config`s that have `dist: true`,
  allowing users to customize the `dist/` output in each `gro build` via `src/gro.config.ts`
  ([#144](https://github.com/feltjs/gro/pull/144))

## 0.11.2

- add a generic parameter to `Task` to type its `Task_Args`
  ([#142](https://github.com/feltjs/gro/pull/142))

## 0.11.1

- track and clean up child processes in `src/lib/util/process.ts` helpers
  and expose the functionality to users as `registerGlobalSpawn`
  ([#141](https://github.com/feltjs/gro/pull/141))
- add a confirmation prompt to `gro version`
  with version validations between `changelog.md` and `package.json`
  ([#140](https://github.com/feltjs/gro/pull/140))

## 0.11.0

- **break**: update dependencies
  ([#139](https://github.com/feltjs/gro/pull/139))

## 0.10.1

- add the `Filer` option `filter` with type `Path_Filter`
  and ignore directories like `.git` by default
  ([#138](https://github.com/feltjs/gro/pull/138))

## 0.10.0

- **break**: change `src/gro.config.ts` to export a `config` identifer instead of `default`
  ([#137](https://github.com/feltjs/gro/pull/137))

## 0.9.5

- set `process.env.NODE_ENV` when running tasks with explicit `dev` values
  ([#136](https://github.com/feltjs/gro/pull/136))
- remove `import.meta.env.DEV` support for now despite SvelteKit alignment
  ([#136](https://github.com/feltjs/gro/pull/136))

## 0.9.4

- forward the optional `dev` arg through the task invocation tree via `invoke_task` and `run_task`
  ([#135](https://github.com/feltjs/gro/pull/135))

## 0.9.3

- add the optional `dev` property to `Task` definitions to fix the inherited context
  ([#134](https://github.com/feltjs/gro/pull/134))

## 0.9.2

- fix `src/lib/build.task.ts` ([#133](https://github.com/feltjs/gro/pull/133)):
  - forward dev arg to esbuild options builder
  - fix return values of rollup plugins to respect sourcemaps

## 0.9.1

- fix `src/lib/build.task.ts` to correctly use `sourcemap` and `target` Gro config options
  ([#132](https://github.com/feltjs/gro/pull/132))
- turn sourcemaps off by default in production
  ([#132](https://github.com/feltjs/gro/pull/132))

## 0.9.0

- **break**: separate the default server and primary Node builds
  in `src/lib/config/gro.config.default.ts`
  ([#131](https://github.com/feltjs/gro/pull/131))
- **break**: rename `src/lib/util/toObtainable.ts` to `src/lib/util/obtainable.ts` to fit convention
  ([#131](https://github.com/feltjs/gro/pull/131))
- add server auto-restart to `src/dev.task.ts`
  ([#129](https://github.com/feltjs/gro/pull/129))
- improve the [clean task](https://github.com/feltjs/gro/blob/main/src/clean.task.ts)
  ([#130](https://github.com/feltjs/gro/pull/130))
  - running `gro clean` with no options behaves the same, deleting `/.gro/` and `/dist/`
  - `gro clean` now accepts a number of options:
    - `-s`: delete `/.svelte/`
    - `-n`: delete `/node_modules/`
    - `-B`: preserve `/.gro/`, the Gro build directory
    - `-D`: preserve `/dist/`

## 0.8.4

- add `src/version.task.ts` to automate versioning and publishing
  ([#127](https://github.com/feltjs/gro/pull/127))
- change `src/lib/build.task.ts` to work internally for Gro
  ([#128](https://github.com/feltjs/gro/pull/128))

## 0.8.3

- change type deps exposed to users to regular dependencies
  ([#126](https://github.com/feltjs/gro/pull/126))

## 0.8.2

- change `Filer` to extend `EventEmitter` and emit a `'build'` event
  ([#125](https://github.com/feltjs/gro/pull/125))

## 0.8.1

- fix build not filtering out `null` inputs
  ([#124](https://github.com/feltjs/gro/pull/124))

## 0.8.0

- **break**: redesign prod build task `src/lib/build.task.ts`
  and remove support for CLI build inputs in favor of config
  ([#123](https://github.com/feltjs/gro/pull/123))
- internal rename of `src/globalTypes.ts` to `src/globals.d.ts`
  now that they only declare module types
  ([#120](https://github.com/feltjs/gro/pull/120))

## 0.7.2

- gracefully handle deprecated Gro frontends
  ([#118](https://github.com/feltjs/gro/pull/118))
- detect default server build at `src/server/server.ts`
  ([#119](https://github.com/feltjs/gro/pull/119))

## 0.7.1

- rename `src/types.ts` to `src/lib/util/types.ts`
  ([#115](https://github.com/feltjs/gro/pull/115))
- add `unwrap` helper to `src/lib/util/types.ts`
  ([#116](https://github.com/feltjs/gro/pull/116))

## 0.7.0

- **break**: change global types to root exports
  ([#114](https://github.com/feltjs/gro/pull/114))

## 0.6.5

- improve the error message when a build config input is missing
  ([#113](https://github.com/feltjs/gro/pull/113))

## 0.6.4

- add `args` hooks to `src/dev.task.ts`
  ([#112](https://github.com/feltjs/gro/pull/112))

## 0.6.3

- fix import path
  ([#111](https://github.com/feltjs/gro/pull/111))
- restrict the dev server to development usage
  ([#107](https://github.com/feltjs/gro/pull/107))

## 0.6.2

- allow deleting input files
  ([#105](https://github.com/feltjs/gro/pull/105))

## 0.6.1

- temporarily pin `esinstall` version to fix a breaking regression

## 0.6.0

- replace Gro's internal testing library `oki` with
  [`uvu`](https://github.com/lukeed/uvu)
  ([#103](https://github.com/feltjs/gro/pull/103))
- add http2 and https support to the dev server
  ([#104](https://github.com/feltjs/gro/pull/104))

## 0.5.0

- change the `build/` directory to `.gro/` and support multiple builds
  ([#59](https://github.com/feltjs/gro/pull/59))
- add support for a config file at `src/gro.config.ts` for custom builds
  ([#67](https://github.com/feltjs/gro/pull/67),
  [#68](https://github.com/feltjs/gro/pull/68),
  [#82](https://github.com/feltjs/gro/pull/82),
  [#83](https://github.com/feltjs/gro/pull/83),
  [#95](https://github.com/feltjs/gro/pull/95))
- add `Filer` to replace `CachingCompiler` with additional filesystem capabilities
  ([#54](https://github.com/feltjs/gro/pull/54),
  [#55](https://github.com/feltjs/gro/pull/55),
  [#58](https://github.com/feltjs/gro/pull/58),
  [#60](https://github.com/feltjs/gro/pull/60),
  [#62](https://github.com/feltjs/gro/pull/62),
  [#63](https://github.com/feltjs/gro/pull/63),
  [#94](https://github.com/feltjs/gro/pull/94),
  [#98](https://github.com/feltjs/gro/pull/98),
  [#99](https://github.com/feltjs/gro/pull/99),
  [#100](https://github.com/feltjs/gro/pull/100),
  [#101](https://github.com/feltjs/gro/pull/101))
- add Svelte compilation to the unbundled compilation strategies
  ([#52](https://github.com/feltjs/gro/pull/52),
  [#56](https://github.com/feltjs/gro/pull/56),
  [#65](https://github.com/feltjs/gro/pull/65),
  [#66](https://github.com/feltjs/gro/pull/66))
- bundle external modules for the browser
  ([#61](https://github.com/feltjs/gro/pull/61),
  [#71](https://github.com/feltjs/gro/pull/71),
  [#76](https://github.com/feltjs/gro/pull/76),
  [#81](https://github.com/feltjs/gro/pull/81),
  [#88](https://github.com/feltjs/gro/pull/88),
  [#89](https://github.com/feltjs/gro/pull/89))
- replace swc with esbuild
  ([#92](https://github.com/feltjs/gro/pull/92))
- make `createBuilder` pluggable allowing users to provide a compiler for each file
  ([#57](https://github.com/feltjs/gro/pull/57))
- rename `compiler` to `builder`
  ([#70](https://github.com/feltjs/gro/pull/70))
- replace deep equality helpers with `dequal`
  ([#73](https://github.com/feltjs/gro/pull/73))
- add a basic client to view project data
  ([#86](https://github.com/feltjs/gro/pull/86),
  [#87](https://github.com/feltjs/gro/pull/87),
  [#90](https://github.com/feltjs/gro/pull/90))
- move terminal color module to src/lib/util
  ([#93](https://github.com/feltjs/gro/pull/93))
- add server caching
  ([#77](https://github.com/feltjs/gro/pull/77))

## 0.4.0

- add `swc` dependency along with a Rollup plugin and Svelte preprocessor
  ([#45](https://github.com/feltjs/gro/pull/45))
- add the `compile` task and use `swc` for non-watchmode builds
  ([#46](https://github.com/feltjs/gro/pull/46))
- add `CachingCompiler` which uses `swc` to replace `tsc` watchmode
  ([#51](https://github.com/feltjs/gro/pull/51))
- add stop function return value to `Timings#start`
  ([#47](https://github.com/feltjs/gro/pull/47))
- rename identifiers from "ext" to "extension" to follow newer convention
  ([#48](https://github.com/feltjs/gro/pull/48))
- convert `AssertionOperator` from an enum to a union of string types
  ([#49](https://github.com/feltjs/gro/pull/49))
- rename `AsyncState` to `AsyncStatus` and convert it from an enum to a union of string types
  ([#50](https://github.com/feltjs/gro/pull/50))

## 0.3.0

- handle build errors in the deploy task and add the `--dry` deploy flag
  ([#42](https://github.com/feltjs/gro/pull/42))
- upgrade dependencies
  ([#43](https://github.com/feltjs/gro/pull/43),
  [#44](https://github.com/feltjs/gro/pull/44))

## 0.2.12

- fix log message when listing all tasks
  ([#41](https://github.com/feltjs/gro/pull/41))

## 0.2.11

- change the deploy task to delete `dist/` when done to avoid git worktree issues
  ([#40](https://github.com/feltjs/gro/pull/40))

## 0.2.10

- add a default `gro deploy` task for GitHub pages
  ([#39](https://github.com/feltjs/gro/pull/39))
- run the clean task at the beginning of the check task
  ([#37](https://github.com/feltjs/gro/pull/37))

## 0.2.9

- sort CSS builds to make output deterministic
  ([#36](https://github.com/feltjs/gro/pull/36))

## 0.2.8

- make Rollup build extensible
  ([#35](https://github.com/feltjs/gro/pull/35))
- upgrade peer dependencies
  ([#34](https://github.com/feltjs/gro/pull/34))

## 0.2.7

- enable sourcemaps for build in development mode
  ([#33](https://github.com/feltjs/gro/pull/33))

## 0.2.6

- add `uuid` utilities
  ([#31](https://github.com/feltjs/gro/pull/31))

## 0.2.5

- add `randomFloat` utility
  ([#30](https://github.com/feltjs/gro/pull/30))

## 0.2.4

- add `Result` type helper to `src/globalTypes.ts`
  ([#29](https://github.com/feltjs/gro/pull/29))

## 0.2.3

- fix external module type declarations by merging
  `src/lib/util/globalTypes.d.ts` into `src/globalTypes.ts`
  ([#28](https://github.com/feltjs/gro/pull/28))

## 0.2.2

- export `kleur/colors` from `src/lib/util/terminal.js`
  ([#27](https://github.com/feltjs/gro/pull/27))

## 0.2.1

- add type helpers `Branded` and `Flavored` for nominal-ish typing
  ([#23](https://github.com/feltjs/gro/pull/23))

## 0.2.0

- **breaking:** upgrade `kleur` dep and remove color wrappers
  ([#26](https://github.com/feltjs/gro/pull/26))

## 0.1.14

- correctly fix `.js` module resolution where
  [#24](https://github.com/feltjs/gro/pull/24) failed
  ([#25](https://github.com/feltjs/gro/pull/25))

## 0.1.13

- change assertions `t.is` and `t.equal` to use a shared generic type for extra safety
  ([#22](https://github.com/feltjs/gro/pull/22))
- fix `.js` module resolution in the Rollup TypeScript plugin
  ([#24](https://github.com/feltjs/gro/pull/24))

## 0.1.12

- add the `invoke_task` helper for task composition
  ([#20](https://github.com/feltjs/gro/pull/20))
- add CLI flags to print the Gro version with `--version` or `-v`
  ([#21](https://github.com/feltjs/gro/pull/21))

## 0.1.11

- fix `terser` import
- export `Unobtain` type from `util/obtainable.ts`

## 0.1.10

- add async `rejects` assertion
  ([#19](https://github.com/feltjs/gro/pull/19))
- change the check task to run tests only if some exist
  ([#18](https://github.com/feltjs/gro/pull/18))

## 0.1.9

- actually fix unbuilt project detection when invoking builtin Gro tasks
  ([#17](https://github.com/feltjs/gro/pull/17))

## 0.1.8

- fix unbuilt project detection when invoking builtin Gro tasks
  ([#16](https://github.com/feltjs/gro/pull/16))

## 0.1.7

- compile TypeScript if an invoked task cannot be found in `build/`
  ([#12](https://github.com/feltjs/gro/pull/12))
- change the check task to look for stale generated files only if the project contains gen files
  ([#13](https://github.com/feltjs/gro/pull/13))
- format files in the root directory, not just `src/`
  ([#15](https://github.com/feltjs/gro/pull/15))

## 0.1.6

- change `gro clean` to delete directories instead of emptying them
  ([#11](https://github.com/feltjs/gro/pull/11))

## 0.1.5

- add `gro format` and `gro format --check` and format generated code
  ([#8](https://github.com/feltjs/gro/pull/8))
- add `prettier` and `prettier-plugin-svelte` as peer dependencies and upgrade to Prettier 2
  ([#8](https://github.com/feltjs/gro/pull/8))

## 0.1.4

- ensure the project has been built when invoking tasks
  ([#5](https://github.com/feltjs/gro/pull/5))

## 0.1.3

- upgrade TypeScript minor version
- rename `util/random.ts` functions, expanding "rand" prefix to "random"

## 0.1.2

- upgrade TypeScript dep
- add `util/obtainable.ts` for decoupled lifecycle management

## 0.1.1

- add `fs/watch_node_fs.ts` for low level filesystem watching
- expose `remove` and `ensure_dir` in `fs/node.ts`

## 0.1.0

- plant in the ground
