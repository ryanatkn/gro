# Gro changelog

## 0.15.0

- **break**: make `src/build.task.ts`, `src/deploy.task.ts`,
  and `src/start.task.ts` work with SvelteKit
  ([#157](https://github.com/feltcoop/gro/pull/157))
  - add flag `gro deploy --clean` to reset deployment state
  - add flag `--branch` to both tasks, default to `main`
  - default to the `deploy` branch instead of `gh-pages`
- **break**: rename `toEnvString` and `toEnvNumber` from `stringFromEnv` and `numberFromEnv`
  ([#158](https://github.com/feltcoop/gro/pull/158))

## 0.14.0

- **break**: rename `src/fs/node.ts` from `src/fs/nodeFs.ts`
  ([#154](https://github.com/feltcoop/gro/pull/154))
- **break**: rename `src/fs/clean.ts` from `src/project/clean.ts`
  ([#155](https://github.com/feltcoop/gro/pull/155))
- **break**: rename `toArray` from `ensureArray`
  ([#117](https://github.com/feltcoop/gro/pull/117))
- upgrade to `svelte@3.37.0`
  ([#102](https://github.com/feltcoop/gro/pull/102))
- fix `dist/` build
  ([#156](https://github.com/feltcoop/gro/pull/156))
- export many more things from root: `import {/* !!! */} from '@feltcoop/gro';`
  ([#117](https://github.com/feltcoop/gro/pull/117))
- improve logging readability
  ([#152](https://github.com/feltcoop/gro/pull/152))

## 0.13.0

- **break**: require Node >=14.16.0
  ([#150](https://github.com/feltcoop/gro/pull/150))
- fix false positive API server detection in default config
  ([#151](https://github.com/feltcoop/gro/pull/151))
- add `getMimeTypes` and `getExtensions` returning iterators to `src/fs/mime.ts`
  ([#149](https://github.com/feltcoop/gro/pull/149))
- improve default asset paths to use registered mime types
  ([#149](https://github.com/feltcoop/gro/pull/149))

## 0.12.1

- fix swapped API server ports
  ([#148](https://github.com/feltcoop/gro/pull/148))

## 0.12.0

- **break**: output builds to `dist/` mirroring the source tree as much as possible
  ([#147](https://github.com/feltcoop/gro/pull/147))
- **break**: rename some things around the API server
  ([#147](https://github.com/feltcoop/gro/pull/147))
- add `gro start` as an alias for `npm start`
  ([#147](https://github.com/feltcoop/gro/pull/147))
- integrate the default Gro API server with SvelteKit and Gro's build task
  ([#145](https://github.com/feltcoop/gro/pull/145))
- add task `gro server` to support the default API server use case in SvelteKit
  ([#145](https://github.com/feltcoop/gro/pull/145))
- remove the `gro dist` task; it's now part of `gro build`
  ([#146](https://github.com/feltcoop/gro/pull/146))

## 0.11.3

- add `events` to `TaskContext` and its generic type to `Task`,
  so tasks can communicate with each other using a normal Node `EventEmitter`
  ([#143](https://github.com/feltcoop/gro/pull/143))
  - events aren't great for everything;
    this PR also documents a value mapping pattern convention for tasks in `src/task/README.md`
- `gro build` now correctly builds only `BuildConfig`s that have `dist: true`,
  allowing users to customize the `dist/` output in each `gro build` via `src/gro.config.ts`
  ([#144](https://github.com/feltcoop/gro/pull/144))

## 0.11.2

- add a generic parameter to `Task` to type its `TaskArgs`
  ([#142](https://github.com/feltcoop/gro/pull/142))

## 0.11.1

- track and clean up child processes in `src/utils/process.ts` helpers
  and expose the functionality to users as `registerGlobalSpawn`
  ([#141](https://github.com/feltcoop/gro/pull/141))
- add a confirmation prompt to `gro version`
  with version validations between `changelog.md` and `package.json`
  ([#140](https://github.com/feltcoop/gro/pull/140))

## 0.11.0

- **break**: update dependencies
  ([#139](https://github.com/feltcoop/gro/pull/139))

## 0.10.1

- add the `Filer` option `filter` with type `PathFilter`
  and ignore directories like `.git` by default
  ([#138](https://github.com/feltcoop/gro/pull/138))

## 0.10.0

- **break**: change `src/gro.config.ts` to export a `config` identifer instead of `default`
  ([#137](https://github.com/feltcoop/gro/pull/137))

## 0.9.5

- set `process.env.NODE_ENV` when running tasks with explicit `dev` values
  ([#136](https://github.com/feltcoop/gro/pull/136))
- remove `import.meta.env.DEV` support for now despite SvelteKit alignment
  ([#136](https://github.com/feltcoop/gro/pull/136))

## 0.9.4

- forward the optional `dev` arg through the task invocation tree via `invokeTask` and `runTask`
  ([#135](https://github.com/feltcoop/gro/pull/135))

## 0.9.3

- add the optional `dev` property to `Task` definitions to fix the inherited context
  ([#134](https://github.com/feltcoop/gro/pull/134))

## 0.9.2

- fix `src/build.task.ts` ([#133](https://github.com/feltcoop/gro/pull/133)):
  - forward dev arg to esbuild options builder
  - fix return values of rollup plugins to respect sourcemaps

## 0.9.1

- fix `src/build.task.ts` to correctly use `sourcemap` and `target` Gro config options
  ([#132](https://github.com/feltcoop/gro/pull/132))
- turn sourcemaps off by default in production
  ([#132](https://github.com/feltcoop/gro/pull/132))

## 0.9.0

- **break**: separate the default server and primary Node builds
  in `src/config/gro.config.default.ts`
  ([#131](https://github.com/feltcoop/gro/pull/131))
- **break**: rename `src/utils/createObtainable.ts` to `src/utils/obtainable.ts` to fit convention
  ([#131](https://github.com/feltcoop/gro/pull/131))
- add server auto-restart to `src/dev.task.ts`
  ([#129](https://github.com/feltcoop/gro/pull/129))
- improve the [clean task](https://github.com/feltcoop/gro/blob/main/src/clean.task.ts)
  ([#130](https://github.com/feltcoop/gro/pull/130))
  - running `gro clean` with no options behaves the same, deleting `/.gro/` and `/dist/`
  - `gro clean` now accepts a number of options:
    - `-s`: delete `/.svelte/`
    - `-n`: delete `/node_modules/`
    - `-B`: preserve `/.gro/`, the Gro build directory
    - `-D`: preserve `/dist/`

## 0.8.4

- add `src/version.task.ts` to automate versioning and publishing
  ([#127](https://github.com/feltcoop/gro/pull/127))
- change `src/build.task.ts` to work internally for Gro
  ([#128](https://github.com/feltcoop/gro/pull/128))

## 0.8.3

- change type deps exposed to users to regular dependencies
  ([#126](https://github.com/feltcoop/gro/pull/126))

## 0.8.2

- change `Filer` to extend `EventEmitter` and emit a `'build'` event
  ([#125](https://github.com/feltcoop/gro/pull/125))

## 0.8.1

- fix build not filtering out `null` inputs
  ([#124](https://github.com/feltcoop/gro/pull/124))

## 0.8.0

- **break**: redesign prod build task `src/build.task.ts`
  and remove support for CLI build inputs in favor of config
  ([#123](https://github.com/feltcoop/gro/pull/123))
- internal rename of `src/globalTypes.ts` to `src/globals.d.ts`
  now that they only declare module types
  ([#120](https://github.com/feltcoop/gro/pull/120))

## 0.7.2

- gracefully handle deprecated Gro frontends
  ([#118](https://github.com/feltcoop/gro/pull/118))
- detect default server build at `src/server/server.ts`
  ([#119](https://github.com/feltcoop/gro/pull/119))

## 0.7.1

- rename `src/types.ts` to `src/utils/types.ts`
  ([#115](https://github.com/feltcoop/gro/pull/115))
- add `unwrap` helper to `src/utils/types.ts`
  ([#116](https://github.com/feltcoop/gro/pull/116))

## 0.7.0

- **break**: change global types to root exports
  ([#114](https://github.com/feltcoop/gro/pull/114))

## 0.6.5

- improve the error message when a build config input is missing
  ([#113](https://github.com/feltcoop/gro/pull/113))

## 0.6.4

- add `args` hooks to `src/dev.task.ts`
  ([#112](https://github.com/feltcoop/gro/pull/112))

## 0.6.3

- fix import path
  ([#111](https://github.com/feltcoop/gro/pull/111))
- restrict the dev server to development usage
  ([#107](https://github.com/feltcoop/gro/pull/107))

## 0.6.2

- allow deleting input files
  ([#105](https://github.com/feltcoop/gro/pull/105))

## 0.6.1

- temporarily pin `esinstall` version to fix a breaking regression

## 0.6.0

- replace Gro's internal testing library `oki` with
  [`uvu`](https://github.com/lukeed/uvu)
  ([#103](https://github.com/feltcoop/gro/pull/103))
- add http2 and https support to the dev server
  ([#104](https://github.com/feltcoop/gro/pull/104))

## 0.5.0

- change the `build/` directory to `.gro/` and support multiple builds
  ([#59](https://github.com/feltcoop/gro/pull/59))
- add support for a config file at `src/gro.config.ts` for custom builds
  ([#67](https://github.com/feltcoop/gro/pull/67),
  [#68](https://github.com/feltcoop/gro/pull/68),
  [#82](https://github.com/feltcoop/gro/pull/82),
  [#83](https://github.com/feltcoop/gro/pull/83),
  [#95](https://github.com/feltcoop/gro/pull/95))
- add `Filer` to replace `CachingCompiler` with additional filesystem capabilities
  ([#54](https://github.com/feltcoop/gro/pull/54),
  [#55](https://github.com/feltcoop/gro/pull/55),
  [#58](https://github.com/feltcoop/gro/pull/58),
  [#60](https://github.com/feltcoop/gro/pull/60),
  [#62](https://github.com/feltcoop/gro/pull/62),
  [#63](https://github.com/feltcoop/gro/pull/63),
  [#94](https://github.com/feltcoop/gro/pull/94),
  [#98](https://github.com/feltcoop/gro/pull/98),
  [#99](https://github.com/feltcoop/gro/pull/99),
  [#100](https://github.com/feltcoop/gro/pull/100),
  [#101](https://github.com/feltcoop/gro/pull/101))
- add Svelte compilation to the unbundled compilation strategies
  ([#52](https://github.com/feltcoop/gro/pull/52),
  [#56](https://github.com/feltcoop/gro/pull/56),
  [#65](https://github.com/feltcoop/gro/pull/65),
  [#66](https://github.com/feltcoop/gro/pull/66))
- bundle external modules for the browser
  ([#61](https://github.com/feltcoop/gro/pull/61),
  [#71](https://github.com/feltcoop/gro/pull/71),
  [#76](https://github.com/feltcoop/gro/pull/76),
  [#81](https://github.com/feltcoop/gro/pull/81),
  [#88](https://github.com/feltcoop/gro/pull/88),
  [#89](https://github.com/feltcoop/gro/pull/89))
- replace swc with esbuild
  ([#92](https://github.com/feltcoop/gro/pull/92))
- make `createBuilder` pluggable allowing users to provide a compiler for each file
  ([#57](https://github.com/feltcoop/gro/pull/57))
- rename `compiler` to `builder`
  ([#70](https://github.com/feltcoop/gro/pull/70))
- replace deep equality helpers with `dequal`
  ([#73](https://github.com/feltcoop/gro/pull/73))
- add a basic client to view project data
  ([#86](https://github.com/feltcoop/gro/pull/86),
  [#87](https://github.com/feltcoop/gro/pull/87),
  [#90](https://github.com/feltcoop/gro/pull/90))
- move terminal color module to src/utils
  ([#93](https://github.com/feltcoop/gro/pull/93))
- add server caching
  ([#77](https://github.com/feltcoop/gro/pull/77))

## 0.4.0

- add `swc` dependency along with a Rollup plugin and Svelte preprocessor
  ([#45](https://github.com/feltcoop/gro/pull/45))
- add the `compile` task and use `swc` for non-watchmode builds
  ([#46](https://github.com/feltcoop/gro/pull/46))
- add `CachingCompiler` which uses `swc` to replace `tsc` watchmode
  ([#51](https://github.com/feltcoop/gro/pull/51))
- add stop function return value to `Timings#start`
  ([#47](https://github.com/feltcoop/gro/pull/47))
- rename identifiers from "ext" to "extension" to follow newer convention
  ([#48](https://github.com/feltcoop/gro/pull/48))
- convert `AssertionOperator` from an enum to a union of string types
  ([#49](https://github.com/feltcoop/gro/pull/49))
- rename `AsyncState` to `AsyncStatus` and convert it from an enum to a union of string types
  ([#50](https://github.com/feltcoop/gro/pull/50))

## 0.3.0

- handle build errors in the deploy task and add the `--dry` deploy flag
  ([#42](https://github.com/feltcoop/gro/pull/42))
- upgrade dependencies
  ([#43](https://github.com/feltcoop/gro/pull/43),
  [#44](https://github.com/feltcoop/gro/pull/44))

## 0.2.12

- fix log message when listing all tasks
  ([#41](https://github.com/feltcoop/gro/pull/41))

## 0.2.11

- change the deploy task to delete `dist/` when done to avoid git worktree issues
  ([#40](https://github.com/feltcoop/gro/pull/40))

## 0.2.10

- add a default `gro deploy` task for GitHub pages
  ([#39](https://github.com/feltcoop/gro/pull/39))
- run the clean task at the beginning of the check task
  ([#37](https://github.com/feltcoop/gro/pull/37))

## 0.2.9

- sort CSS builds to make output deterministic
  ([#36](https://github.com/feltcoop/gro/pull/36))

## 0.2.8

- make Rollup build extensible
  ([#35](https://github.com/feltcoop/gro/pull/35))
- upgrade peer dependencies
  ([#34](https://github.com/feltcoop/gro/pull/34))

## 0.2.7

- enable sourcemaps for build in development mode
  ([#33](https://github.com/feltcoop/gro/pull/33))

## 0.2.6

- add `uuid` utilities
  ([#31](https://github.com/feltcoop/gro/pull/31))

## 0.2.5

- add `randomFloat` utility
  ([#30](https://github.com/feltcoop/gro/pull/30))

## 0.2.4

- add `Result` type helper to `src/globalTypes.ts`
  ([#29](https://github.com/feltcoop/gro/pull/29))

## 0.2.3

- fix external module type declarations by merging
  `src/project/globalTypes.d.ts` into `src/globalTypes.ts`
  ([#28](https://github.com/feltcoop/gro/pull/28))

## 0.2.2

- export `kleur/colors` from `src/utils/terminal.js`
  ([#27](https://github.com/feltcoop/gro/pull/27))

## 0.2.1

- add type helpers `Branded` and `Flavored` for nominal-ish typing
  ([#23](https://github.com/feltcoop/gro/pull/23))

## 0.2.0

- **breaking:** upgrade `kleur` dep and remove color wrappers
  ([#26](https://github.com/feltcoop/gro/pull/26))

## 0.1.14

- correctly fix `.js` module resolution where
  [#24](https://github.com/feltcoop/gro/pull/24) failed
  ([#25](https://github.com/feltcoop/gro/pull/25))

## 0.1.13

- change assertions `t.is` and `t.equal` to use a shared generic type for extra safety
  ([#22](https://github.com/feltcoop/gro/pull/22))
- fix `.js` module resolution in the Rollup TypeScript plugin
  ([#24](https://github.com/feltcoop/gro/pull/24))

## 0.1.12

- add the `invokeTask` helper for task composition
  ([#20](https://github.com/feltcoop/gro/pull/20))
- add CLI flags to print the Gro version with `--version` or `-v`
  ([#21](https://github.com/feltcoop/gro/pull/21))

## 0.1.11

- fix `terser` import
- export `Unobtain` type from `utils/obtainable.ts`

## 0.1.10

- add async `rejects` assertion
  ([#19](https://github.com/feltcoop/gro/pull/19))
- change the check task to run tests only if some exist
  ([#18](https://github.com/feltcoop/gro/pull/18))

## 0.1.9

- actually fix unbuilt project detection when invoking builtin Gro tasks
  ([#17](https://github.com/feltcoop/gro/pull/17))

## 0.1.8

- fix unbuilt project detection when invoking builtin Gro tasks
  ([#16](https://github.com/feltcoop/gro/pull/16))

## 0.1.7

- compile TypeScript if an invoked task cannot be found in `build/`
  ([#12](https://github.com/feltcoop/gro/pull/12))
- change the check task to look for stale generated files only if the project contains gen files
  ([#13](https://github.com/feltcoop/gro/pull/13))
- format files in the root directory, not just `src/`
  ([#15](https://github.com/feltcoop/gro/pull/15))

## 0.1.6

- change `gro clean` to delete directories instead of emptying them
  ([#11](https://github.com/feltcoop/gro/pull/11))

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
- add `utils/obtainable.ts` for decoupled lifecycle management

## 0.1.1

- add `fs/watchNodeFs.ts` for low level filesystem watching
- expose `remove` and `ensureDir` in `fs/node.ts`

## 0.1.0

- plant in the ground
