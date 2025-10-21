# Gro Architecture Reference

> Task runner and toolkit extending SvelteKit - conventions over configuration, filesystem as API

Gro (`@ryanatkn/gro`) is a dev tool for building TypeScript projects with SvelteKit, providing: convention-based task runner, Node loader for TypeScript/Svelte/SvelteKit modules, code generation system, plugin architecture, and integrations with Vite, esbuild, Vitest, Prettier, ESLint, and Changesets. It's designed around conventions and the filesystem, not configuration files.

## Core Systems

### Task Runner

[Full documentation: src/docs/task.md](src/docs/task.md)

Tasks are TypeScript modules with `.task.ts` suffix that export a `task` object with a `run` function. The task runner discovers tasks by convention, resolves them through a search path, and provides a context with args, config, logger, timings, and utilities.

**Discovery & Resolution:**
- Searches `task_root_dirs` in order (default: `src/lib/` → `./` → `gro/dist/`)
- `gro foo` looks for `foo.task.ts` in search path, user tasks override builtins
- `gro gro/foo` directly calls builtin, bypassing local overrides
- `gro some/dir` lists all tasks in that directory
- Absolute paths (starting with `/`) and explicit relative paths (`./`, `../`) skip search
- Implicit relative paths (`foo/bar`) go through search path

**Key Features:**
- **Lazy loading** - Only imports the invoked task and its dependencies
- **Zod schemas** - Optional `Args` property for validation, types, and auto-generated `--help`
- **Composition** - Use `invoke_task` helper (respects overrides) or direct imports
- **Args forwarding** - CLI args like `gro dev -- vite --port 3000` forward to external commands
  - Multiple sections: `gro dev -- vite --port 3000 -- svelte-kit --debug`
  - Special case for nested Gro tasks: `gro check -- gro test --coverage` forwards to test
  - Forwarded args override direct args: `gro test --a 1 -- gro test --a 2` results in `{a: 2}`
  - `invoke_task` automatically forwards CLI args to invoked tasks
- **Error handling** - `Task_Error` suppresses stack trace, `Silent_Error` exits silently

**Task Composition Patterns:**
- `invoke_task('test', args)` - Respects user overrides, better logging, auto-forwards args (recommended)
- Direct import - `import {task} from './test.task.js'; await task.run(ctx)` - Faster, tight coupling

**Task Context:**
```typescript
interface Task_Context<T_Args = object> {
  args: T_Args;
  config: Gro_Config;
  svelte_config: Parsed_Svelte_Config;
  log: Logger;
  timings: Timings;
  invoke_task: Invoke_Task;
}
```

**Example Task:**
```typescript
import type {Task} from '@ryanatkn/gro';
import {z} from 'zod';

export const Args = z.strictObject({
  name: z.string().default('world'),
});

export const task: Task<typeof Args> = {
  summary: 'greets someone',
  Args,
  run: async ({args, log}) => {
    log.info(`Hello, ${args.name}!`);
  },
};
```

Run with: `gro mytask` or `gro mytask --name Alice`

**Overriding Builtin Tasks:**
```typescript
export const task: Task = {
  run: async ({invoke_task, args}) => {
    await setupCustomEnvironment();
    await invoke_task('gro/test', args); // call builtin
    await teardownCustomEnvironment();
  },
};
```

### Node Loader

[Implementation: src/lib/loader.ts, src/lib/register.ts](src/lib/loader.ts)

Custom Node module loader enabling direct execution of TypeScript and Svelte files without compilation step. Registered via `gro run foo.ts` or `node --import @ryanatkn/gro/register.js foo.ts`.

**Capabilities:**
- TypeScript files (`.ts`) via Node's experimental type stripping (`--experimental-strip-types`)
- Svelte components (`.svelte`) with SSR compilation using `compile()`
- Svelte runes in TypeScript (`.svelte.ts`) using `compileModule()`
- JSON imports (any extension with `type: 'json'` import attribute)
- Raw text imports (`.css`, `.svg`, or `?raw` suffix)

**SvelteKit Module Shims:**
Best-effort shims for tasks/tests/servers, not identical to actual SvelteKit modules:
- `$lib/*` → resolved via svelte.config.js alias to `src/lib/`
- `$env/static/public` → reads `PUBLIC_*` vars from `.env`
- `$env/static/private` → reads all vars from `.env`
- `$env/dynamic/public` → `process.env` with `PUBLIC_*` filtering
- `$env/dynamic/private` → full `process.env`
- `$app/environment` → `{dev: true, browser: false, building: false, version: ''}`
- `$app/paths` → `{base: '', assets: ''}` from svelte.config.js

### Code Generation

[Full documentation: src/docs/gen.md](src/docs/gen.md)

Convention-based codegen system where files containing `.gen.` in their name export a `gen` function or config object. The `gro gen` task finds these files, runs them, and writes output to the filesystem.

**Naming Convention:**
- `foo.gen.ts` → outputs `foo.ts`
- `foo.gen.html.ts` → outputs `foo.html`
- Multiple extensions stripped: `.gen.` is removed, last `.ts` dropped
- Custom output via `{content: '...', filename: 'custom.ts'}`
- Can return array for multiple output files

**Return Values:**
- String: default filename, auto-formatted with Prettier
- Object: `{content, filename?, format?}` for control
- Array: multiple files from one genfile
- `null`: no-op

**Dependencies:**
By default, genfiles regenerate when they or their imports change. Customize via `dependencies` property:
- `'all'` - regenerate on any file change
- `{patterns: [/\.json$/], files: ['package.json']}` - static patterns/files
- Function returning config - dynamic based on which file changed

**When It Runs:**
- `gro gen` - manual trigger
- `gro dev` - watch mode, throttled queue via `gro_plugin_gen`
- `gro build` - one-time generation (assumes fresh, verified by CI)
- `gro sync` - before syncing package.json
- `gro gen --check` - verify no drift (used by `gro check` and CI)

**Gen Context:**
```typescript
interface Gen_Context {
  config: Gro_Config;
  svelte_config: Parsed_Svelte_Config;
  filer: Filer;
  log: Logger;
  timings: Timings;
  invoke_task: Invoke_Task;
  origin_id: Path_Id;        // Same as import.meta.url in path form
  origin_path: string;        // origin_id relative to root dir
  changed_file_id: Path_Id | undefined; // Only during dependency checking
}
```

**Example Genfile:**
```typescript
import type {Gen} from '@ryanatkn/gro';

export const gen: Gen = async () => {
  const routes = await findRoutes();
  return `export const ROUTES = ${JSON.stringify(routes)};`;
};

// Multiple outputs:
export const gen: Gen = async () => [
  {content: 'export const foo = 1;', filename: 'foo.ts'},
  {content: '{"version": 1}', filename: 'data.json'},
];

// With dependencies:
export const gen: Gen_Config = {
  generate: () => 'generated content',
  dependencies: {
    patterns: [/\.json$/],
    files: ['package.json'],
  },
};
```

### Plugin System

[Full documentation: src/docs/plugin.md](src/docs/plugin.md)

Plugins customize `gro dev` and `gro build` workflows with three lifecycle hooks: `setup`, `adapt`, and `teardown`. They're objects with a `name` and optional async functions for each phase.

**Lifecycle:**
- **setup** - Runs first in both dev and build
- **adapt** - Runs second, build only (for SvelteKit adapters)
- **teardown** - Runs last, build only or dev with `--no-watch`

**Dev vs Build:**
- `gro dev` - Creates plugins with `{dev: true, watch: true}`, runs setup, keeps process alive
- `gro dev --no-watch` - Runs setup → teardown, exits
- `gro build` - Creates plugins with `{dev: false, watch: false}`, runs setup → adapt → teardown

**Plugin Interface:**
```typescript
interface Plugin<T_Plugin_Context extends Plugin_Context = Plugin_Context> {
  name: string;
  setup?: (ctx: T_Plugin_Context) => void | Promise<void>;
  adapt?: (ctx: T_Plugin_Context) => void | Promise<void>;
  teardown?: (ctx: T_Plugin_Context) => void | Promise<void>;
}

interface Plugin_Context<T_Args = object> extends Task_Context<T_Args> {
  dev: boolean;
  watch: boolean;
}
```

**Builtin Plugins:**
- `gro_plugin_gen` - Watches files, queues genfiles when they or dependencies change
- `gro_plugin_sveltekit_app` - Runs `vite dev` or `vite build` for SvelteKit frontends ([docs](src/docs/gro_plugin_sveltekit_app.md))
- `gro_plugin_sveltekit_library` - Runs `svelte-package` to publish from `src/lib/`
- `gro_plugin_server` - Runs Node servers with auto-restart on changes

### Configuration

[Full documentation: src/docs/config.md](src/docs/config.md)

Optional `gro.config.ts` at project root exports `Create_Gro_Config` function or config object. If absent, uses default config from `src/lib/gro.config.default.ts`.

**Default Config Behavior:**
Auto-detects project type by checking filesystem:
- `src/routes` → enables `gro_plugin_sveltekit_app`
- `@sveltejs/package` in package.json → enables `gro_plugin_sveltekit_library`
- `src/lib/server/server.ts` → enables `gro_plugin_server`
- Always enables `gro_plugin_gen`

**Config Interface:**
```typescript
interface Gro_Config {
  plugins: Create_Config_Plugins;           // Function returning array of plugins
  map_package_json: Map_Package_Json | null; // Hook for package.json automations
  task_root_dirs: Array<Path_Id>;           // Where to search for tasks
  search_filters: Array<Path_Filter>;       // Exclude patterns for discovery
  js_cli: string;                           // Node-compatible CLI (default: 'node')
  pm_cli: string;                           // npm-compatible CLI (default: 'npm')
}
```

**map_package_json:**
Runs during `gro sync` to auto-generate `"exports"` field in package.json using wildcard patterns. Excludes tests (`*.test.*`), markdown (`*.md`), and ignored files (`*.ignore.*`, `/test/`, `/fixtures/`). Return `null` to opt out.

**Example Config:**
```typescript
import type {Create_Gro_Config} from '@ryanatkn/gro';

const config: Create_Gro_Config = async (base_config) => {
  // Extend default plugins
  const base_plugins = base_config.plugins;
  base_config.plugins = async (ctx) => {
    const plugins = await base_plugins(ctx);
    return [...plugins, myCustomPlugin()];
  };

  // Customize package.json automation
  base_config.map_package_json = (pkg) => {
    pkg.exports = {'.': './dist/index.js'};
    return pkg;
  };

  return base_config;
};

export default config;
```

## File Conventions

**Task files**: `*.task.ts` in `src/lib/` (or configured `task_root_dirs`)
**Gen files**: `*.gen.*` anywhere in `src/` (pattern: `.gen.` substring)
**Test files**: `*.test.ts` anywhere (run by Vitest)
**Config**: `gro.config.ts` at project root
**SvelteKit config**: `svelte.config.js` at project root

**Exclusions** (configurable via `search_filters`):
- Dot-prefixed directories (`.git`, `.svelte-kit`, `.gro`)
- `node_modules/` (except `node_modules/@*/gro/dist/`)
- Build directories: `.svelte-kit/`, `build/`, `dist/` (except in Gro's own directory)

## Builtin Tasks

[Complete list: src/docs/tasks.md](src/docs/tasks.md)

**Development**: `dev`, `test`, `gen`, `format`, `lint`, `typecheck`
**Production**: `build`, `check`, `publish`, `deploy`, `release`
**Utilities**: `clean`, `sync`, `run`, `changeset`, `commit`, `reinstall`, `resolve`, `upgrade`

**Key Tasks:**
- `dev` - Start dev server with watch mode (SvelteKit + Vite via plugins) ([docs](src/docs/dev.md))
- `test` - Run Vitest tests matching `.test.` pattern ([docs](src/docs/test.md))
- `gen` - Run code generation ([docs](src/docs/gen.md))
- `build` - Production build with intelligent caching (runs plugin lifecycle: setup → adapt → teardown) ([docs](src/docs/build.md))
  - **Build caching**: Skips expensive rebuilds when nothing changed, using git commit hash + optional custom config
  - Cache stored at `.gro/build.json`, survives manual deletion of `build/`
  - Dirty workspace (uncommitted changes) → always rebuilds, deletes cache + `dist/` outputs to prevent stale state
  - Force rebuild: `gro build --force_build`
- `check` - Run all checks (test, gen --check, format --check, lint, typecheck)
- `sync` - Run gen, update package.json exports, optionally install packages
- `publish` - Version with Changesets, publish to npm, push to git ([docs](src/docs/publish.md))
- `deploy` - Build and force push to git branch (default: `deploy`) ([docs](src/docs/deploy.md))
- `run` - Execute TypeScript file with Gro's loader

## Architecture Patterns & Design

**Filesystem as API**: Tasks, genfiles, and tests discovered by naming convention (`.task.ts`, `.gen.*`, `.test.ts`). No registration needed - creating a file makes it available.

**Lazy Loading**: Only invoked tasks and their dependencies get imported. Running `gro` lists all tasks but doesn't execute their code.

**Conventions over Configuration**: File naming patterns define behavior. Minimal config files (optional `gro.config.ts`). Default config auto-detects project type by inspecting filesystem.

**User Overrides**: Local `src/lib/foo.task.ts` takes precedence over `gro/dist/foo.task.js`. Call builtin explicitly with `gro gro/foo`. All of Gro's internals exported from `$lib` for reuse.

**Plugin Lifecycle**: Setup initializes, adapt handles production finalization (SvelteKit adapters), teardown cleans up. Watch mode skips teardown to keep processes alive.

**Filer**: Central filesystem tracker in task/plugin context. Watches files in dev mode, tracks dependencies between modules, used by gen plugin to trigger regeneration.

**Timings**: Performance tracking API. `const timing = timings.start('name'); await work(); timing();` logs duration.

**Minimal Abstraction**: Thin layer over tools (Vite, esbuild, Vitest), forwarding args and exposing internals. TypeScript everywhere (tasks, config, genfiles).

## Implementation Reference

**Core Systems** (src/lib/):
- CLI & Task invocation: `gro.ts`, `invoke.ts`, `task.ts`, `invoke_task.ts`, `run_task.ts`, `input_path.ts`
- Code generation: `gen.ts`, `gen.task.ts`, `run_gen.ts`, `gen_helpers.ts`
- Plugins: `plugin.ts`, `gro_plugin_*.ts` (gen, sveltekit_app, sveltekit_library, server)
- Config: `gro_config.ts`, `gro.config.default.ts`
- Loader: `loader.ts`, `register.ts`

**Key Utilities**:
- Filesystem: `filer.ts`, `fs.ts`, `paths.ts`, `search_fs.ts`
- Module handling: `modules.ts`, `format_file.ts`, `package_json.ts`, `args.ts`
- SvelteKit integration: `svelte_config.ts`, `sveltekit_shim_*.ts`, `esbuild_plugin_sveltekit_*.ts`
- Build tools: `esbuild_helpers.ts`, `esbuild_plugin_svelte.ts`

**Documentation**: [Complete index at src/docs/README.md](src/docs/README.md) - Core topics: [task](src/docs/task.md), [gen](src/docs/gen.md), [plugin](src/docs/plugin.md), [config](src/docs/config.md), [test](src/docs/test.md) | Workflows: [dev](src/docs/dev.md), [build](src/docs/build.md), [deploy](src/docs/deploy.md), [publish](src/docs/publish.md)
