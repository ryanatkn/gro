# changelog

## 0.30.1

- upgrade to esbuild@0.12.15
  ([#235](https://github.com/feltcoop/gro/pull/235))

## 0.30.0

- **break**: change default server to `src/lib/server/server.ts` from `src/server/server.ts`
  ([#234](https://github.com/feltcoop/gro/pull/234))

## 0.29.0

- **break**: rename plugins, adapters, and builders to `snake_case` from `kebab-case`
  ([#232](https://github.com/feltcoop/gro/pull/232))
- update deps
  ([#233](https://github.com/feltcoop/gro/pull/233))

## 0.28.3

- fix buildless builds to handle SvelteKit-only frontend projects
  ([#230](https://github.com/feltcoop/gro/pull/230))

## 0.28.2

- upgrade to `@feltcoop/felt@0.3.0`
  ([#229](https://github.com/feltcoop/gro/pull/229))

## 0.28.1

- fix library adapter `package.json` paths
  ([#228](https://github.com/feltcoop/gro/pull/228))

## 0.28.0

- **break**: remove `gro start` task
  ([#223](https://github.com/feltcoop/gro/pull/223))
- add `Plugin`s and `config.plugin` to support SvelteKit and API servers
  ([#223](https://github.com/feltcoop/gro/pull/223),
  [#224](https://github.com/feltcoop/gro/pull/224))
- implement API server config and adapter
  ([#223](https://github.com/feltcoop/gro/pull/223))
- implement library adapter
  ([#226](https://github.com/feltcoop/gro/pull/226),
  [#227](https://github.com/feltcoop/gro/pull/227))

## 0.27.3

- fix default library build to include types in production
  ([#222](https://github.com/feltcoop/gro/pull/222))

## 0.27.2

- fix deploy task
  ([#221](https://github.com/feltcoop/gro/pull/221))

## 0.27.1

- support absolute path imports `$lib/` and `src/`
  ([#153](https://github.com/feltcoop/gro/pull/153))
- infer `npm link` in Node library adapter
  ([#218](https://github.com/feltcoop/gro/pull/218))
- fix build config validation and normalization
  ([#220](https://github.com/feltcoop/gro/pull/220))

## 0.27.0

- **break**: convert to `snake_case` from `camelCase`
  ([#210](https://github.com/feltcoop/gro/pull/210))
- **break**: rename `'system'` build from `'node'`
  ([#207](https://github.com/feltcoop/gro/pull/207))
- **break**: add `'config'` build to simplify internals
  ([#207](https://github.com/feltcoop/gro/pull/207),
  [#212](https://github.com/feltcoop/gro/pull/212))
- **break**: build configs now fail to validate if any input path strings do not exist
  ([#207](https://github.com/feltcoop/gro/pull/207))
- **break**: rename `load_config` from `loadGro_Config`
  ([#207](https://github.com/feltcoop/gro/pull/207))
- **break**: change `validate_build_configs` function signature
  ([#207](https://github.com/feltcoop/gro/pull/207))
- **break**: change `gro_adapter_sveltekit_frontend` output so it composes with others
  ([#207](https://github.com/feltcoop/gro/pull/207))
- **break**: rename the `Task` `summary` property from `description`
  ([#212](https://github.com/feltcoop/gro/pull/212))
- **break**: rename `content` from `contents`
  ([#216](https://github.com/feltcoop/gro/pull/216))
- add `no-watch` arg to `gro dev`
  ([#211](https://github.com/feltcoop/gro/pull/211))
- rename some args in `gro dev` and `gro serve`
  ([#211](https://github.com/feltcoop/gro/pull/211))
- optimize writing source meta to disk
  ([#214](https://github.com/feltcoop/gro/pull/214))
- add `typemap` option to Gro config
  ([#215](https://github.com/feltcoop/gro/pull/215))
- add `types` option to Gro config
  ([#215](https://github.com/feltcoop/gro/pull/215))

## 0.26.2

- support publishing library builds
  ([#209](https://github.com/feltcoop/gro/pull/209))
- fix typemaps for production builds
  ([#209](https://github.com/feltcoop/gro/pull/209))

## 0.26.1

- rename default `'library'` build from `'lib'`
  ([#208](https://github.com/feltcoop/gro/pull/208))

## 0.26.0

- **break**: move utils to `@feltcoop/felt` and add it as a dependency
  ([#206](https://github.com/feltcoop/gro/pull/206))

## 0.25.2

- properly detect unclean git state for `gro deploy`
  ([#205](https://github.com/feltcoop/gro/pull/205))

## 0.25.1

- add `.nojekyll` support to frontend adapters for GitHub Pages compatibility
  ([#204](https://github.com/feltcoop/gro/pull/204))

## 0.25.0

- **break**: upgrade to latest SvelteKit, changing the dir `.svelte` to `.svelte-kit`
  ([#202](https://github.com/feltcoop/gro/pull/202))
- add SvelteKit frontend adapter
  ([#193](https://github.com/feltcoop/gro/pull/193))
- fix `gro deploy`
  ([#193](https://github.com/feltcoop/gro/pull/193))

## 0.24.1

- separate source meta for dev and prod
  ([#201](https://github.com/feltcoop/gro/pull/201))

## 0.24.0

- **break**: extend config with detected defaults
  ([#199](https://github.com/feltcoop/gro/pull/199))
- improve `gro publish` errors and suport restricted packages
  ([#199](https://github.com/feltcoop/gro/pull/199))

## 0.23.7

- fix `gro publish` arg forwarding to `npm version`
  ([#200](https://github.com/feltcoop/gro/pull/200))
- fix `gro publish` to initialize scoped packages
  ([#200](https://github.com/feltcoop/gro/pull/200))

## 0.23.6

- tweak publish steps to handle failure better

## 0.23.5

- tweak publishing errors

## 0.23.4

- fix typemap source path
  ([#198](https://github.com/feltcoop/gro/pull/198))
- improve publishing changelog UX
  ([#197](https://github.com/feltcoop/gro/pull/197))

## 0.23.3

- generate types for bundled production builds
  ([#196](https://github.com/feltcoop/gro/pull/196))

## 0.23.2

- generate types for production builds
  ([#194](https://github.com/feltcoop/gro/pull/194),
  [#195](https://github.com/feltcoop/gro/pull/195))

## 0.23.1

- fix arg forwarding
  ([#191](https://github.com/feltcoop/gro/pull/191),
  [#192](https://github.com/feltcoop/gro/pull/192))
- fix `gro test` in production, also fixing `gro publish`
  ([#192](https://github.com/feltcoop/gro/pull/192))

## 0.23.0

- **break**: rename `gro publish` from `gro version` and improve its safety
  ([#189](https://github.com/feltcoop/gro/pull/189))
- make `config.builds` optional and accept non-array values
  ([#189](https://github.com/feltcoop/gro/pull/189))
- document more about `adapt`
  ([#189](https://github.com/feltcoop/gro/pull/189))

## 0.22.0

- **break**: redesign `gro publish` and `gro deploy`
  ([#187](https://github.com/feltcoop/gro/pull/187))
- **break**: add [`Adapter` system](src/docs/build.md#adapters) and
  [Node library adapter](src/adapt/gro_adapter_node_library.ts)
  ([#187](https://github.com/feltcoop/gro/pull/187))
- **break**: add a default `"node"` build named `"node"` if one is not defined
  ([#187](https://github.com/feltcoop/gro/pull/187))
- **break**: rename `toObtainable` from `createObtainable`
  ([#187](https://github.com/feltcoop/gro/pull/187))
- **break**: rename `Filesystem.write_file` from `outputFile`
  ([#188](https://github.com/feltcoop/gro/pull/188))
- **break**: upgrade to `fs-extra@10.0.0`
  ([#188](https://github.com/feltcoop/gro/pull/188))

## 0.21.6

- hack: add temporary support for extensionless import paths to internal modules
  ([#186](https://github.com/feltcoop/gro/pull/186))

## 0.21.5

- export config types and helpers from root
  ([#185](https://github.com/feltcoop/gro/pull/185))

## 0.21.4

- export `Unreachable_Error` and time utils from root
  ([#184](https://github.com/feltcoop/gro/pull/184))

## 0.21.3

- force push on `gro deploy`
  ([#183](https://github.com/feltcoop/gro/pull/183))

## 0.21.2

- ignore error on failed `git pull` during `gro deploy`
  ([#182](https://github.com/feltcoop/gro/pull/182))

## 0.21.1

- change `gro gen` to handle failed formatting gracefully
  ([#181](https://github.com/feltcoop/gro/pull/181))

## 0.21.0

- **break**: change `gro clean` args to longhand and
  add option `--git` to prune dead branches
  ([#180](https://github.com/feltcoop/gro/pull/180))
- fix `gro build` to copy files to `dist/` with `src/build/dist.ts` helper `copy_dist`
  ([#179](https://github.com/feltcoop/gro/pull/179))

## 0.20.4

- fix `gro deploy` to first pull the remote deploy branch
  ([#178](https://github.com/feltcoop/gro/pull/178))

## 0.20.3

- fix production builds
  ([#177](https://github.com/feltcoop/gro/pull/177))

## 0.20.2

- refactor Gro's production build
  ([#176](https://github.com/feltcoop/gro/pull/176))

## 0.20.1

- upgrade to npm 7 and its v2 lockfile
  ([#174](https://github.com/feltcoop/gro/pull/174),
  [#175](https://github.com/feltcoop/gro/pull/175))

## 0.20.0

- **break**: rework the `Filesystem` interfaces
  ([#173](https://github.com/feltcoop/gro/pull/173))
  - export a `fs` instance from each `Filesystem` implementation
    and do not export individual functions
  - rename `pathExists` to `exists`
  - remove `readJson`
- add abstract class `Fs` and implement `Memory_Fs`
  to complement the `fs-extra` implementation at `src/fs/node.ts`
  ([#173](https://github.com/feltcoop/gro/pull/173))

## 0.19.0

- **break**: extract the `Filesystem` interface and
  thread it everywhere from `src/cli/invoke.ts` and tests
  ([#171](https://github.com/feltcoop/gro/pull/171))
- **break**: replace `src/utils/gitignore.ts` helper `is_gitignored`
  with `src/fs/path_filter.ts` helper `to_path_filter`
  ([#172](https://github.com/feltcoop/gro/pull/172))

## 0.18.2

- fix `gro start` task to serve static builds to port 3000 like the others
  ([#170](https://github.com/feltcoop/gro/pull/170))

## 0.18.1

- fix `gro start` task to work with SvelteKit and the API server if detected
  ([#169](https://github.com/feltcoop/gro/pull/169))

## 0.18.0

- **break**: change the interface of `gro dev` and `gro build` to support the API server
  ([#168](https://github.com/feltcoop/gro/pull/168))

## 0.17.1

- fix `gro format` to whitelist files off root when formatting `src/`
  ([#166](https://github.com/feltcoop/gro/pull/166))
- fix `gro test` to gracefully handle projects with no Gro build outputs
  ([#167](https://github.com/feltcoop/gro/pull/167))
- run `gro check` before building in `gro version`
  ([#167](https://github.com/feltcoop/gro/pull/167))

## 0.17.0

- **break**: rename `src/utils/equal.ts` module from `deepEqual.ts`
  ([#162](https://github.com/feltcoop/gro/pull/162))
- **break**: rename `Gro_Config_Partial` from `PartialGro_Config`
  and `Build_Config_Partial` from `PartialBuild_Config`
  ([#164](https://github.com/feltcoop/gro/pull/164))
- make serve task work for production SvelteKit builds
  ([#163](https://github.com/feltcoop/gro/pull/163))
- add `src/utils/gitignore.ts` with `is_gitignored` and `load_gitignore_filter`
  ([#165](https://github.com/feltcoop/gro/pull/165))
- add helper `to_sveltekit_base_path` to `src/build/sveltekit_helpers.ts`
  ([#163](https://github.com/feltcoop/gro/pull/163))
- default to some environment variables
  for undefined Gro config properties:
  `GRO_HOST`, `GRO_PORT`, `GRO_LOG_LEVEL`
  ([#162](https://github.com/feltcoop/gro/pull/162))
- export the logger API from root and
  [document](/src/docs/log.md)
  and fix it
  ([#162](https://github.com/feltcoop/gro/pull/162))

## 0.16.0

- **break**: rename some paths constants for consistency
  ([#161](https://github.com/feltcoop/gro/pull/161))
- patch SvelteKit bug with duplicate build directories
  ([#160](https://github.com/feltcoop/gro/pull/160))
- add [contributing.md🌄](./contributing.md)
  ([#108](https://github.com/feltcoop/gro/pull/108))

## 0.15.0

- **break**: make `src/build.task.ts`, `src/deploy.task.ts`,
  and `src/start.task.ts` work with SvelteKit
  ([#157](https://github.com/feltcoop/gro/pull/157),
  [#159](https://github.com/feltcoop/gro/pull/159))
  - add flag `gro deploy --clean` to reset deployment state
  - add flag `--branch` to both tasks, default to `main`
  - default to the `deploy` branch instead of `gh-pages`
- **break**: rename `to_env_string` and `to_env_number` from `stringFromEnv` and `numberFromEnv`
  ([#158](https://github.com/feltcoop/gro/pull/158))
- add helper `read_dir` to `src/fs/node.ts`
  ([#159](https://github.com/feltcoop/gro/pull/159))

## 0.14.0

- **break**: rename `src/fs/node.ts` from `src/fs/nodeFs.ts`
  ([#154](https://github.com/feltcoop/gro/pull/154))
- **break**: rename `src/fs/clean.ts` from `src/utils/clean.ts`
  ([#155](https://github.com/feltcoop/gro/pull/155))
- **break**: rename `to_array` from `ensureArray`
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
- add `get_mime_types` and `get_extensions` returning iterators to `src/fs/mime.ts`
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

- add `events` to `Task_Context` and its generic type to `Task`,
  so tasks can communicate with each other using a normal Node `EventEmitter`
  ([#143](https://github.com/feltcoop/gro/pull/143))
  - events aren't great for everything;
    this PR also documents a value mapping pattern convention for tasks in `src/task/README.md`
- `gro build` now correctly builds only `Build_Config`s that have `dist: true`,
  allowing users to customize the `dist/` output in each `gro build` via `src/gro.config.ts`
  ([#144](https://github.com/feltcoop/gro/pull/144))

## 0.11.2

- add a generic parameter to `Task` to type its `Task_Args`
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

- add the `Filer` option `filter` with type `Path_Filter`
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

- forward the optional `dev` arg through the task invocation tree via `invoke_task` and `run_task`
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
- **break**: rename `src/utils/toObtainable.ts` to `src/utils/obtainable.ts` to fit convention
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
  `src/utils/globalTypes.d.ts` into `src/globalTypes.ts`
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

- add the `invoke_task` helper for task composition
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

- add `fs/watch_node_fs.ts` for low level filesystem watching
- expose `remove` and `ensure_dir` in `fs/node.ts`

## 0.1.0

- plant in the ground
