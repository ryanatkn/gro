# filer

> complete in-memory filesystem mirror with dependency tracking for
> [Gro](https://github.com/ryanatkn/gro)

## contents

- [what](#what)
- [usage](#usage)
- [why](#why)
- [api](#api)
- [design](#design)
- [performance](#performance)
- [limitations](#limitations)
- [error-handling](#error-handling)

## what

The Filer system provides a complete in-memory mirror of your filesystem
with automatic dependency tracking and efficient change propagation.
It's the foundation for Gro's developer tools, enabling features like dependency-aware task execution,
coordinated code generation, and intelligent file watching.

Filer has two main parts:

- **`Disknode`** - represents a file or directory with lazy-loaded properties
  and automatic import dependency tracking
- **`Filer`** - orchestrates the filesystem mirror, batches changes,
  and notifies observers when files change

Think of it as a smart, shared filesystem cache that understands your code's structure
and relationships, eliminating the need for each tool to maintain its own file watcher.

## usage

### basic file watching

Watch TypeScript files and react to changes:

```typescript
import {Filer} from '@ryanatkn/gro/filer.js';

const filer = new Filer();

filer.observe({
	id: 'typescript-watcher',
	patterns: [/\.ts$/],
	on_change: async (batch) => {
		for (const disknode of batch.updated) {
			console.log(`File updated: ${disknode.id}`);
		}
	},
});

await filer.mount(); // start syncing with the filesystem

await filer.dispose(); // teardown
```

### dependency-aware watching

Automatically track files when their dependencies change:

```typescript
filer.observe({
	id: 'dependency-tracker',
	patterns: [/\.test\.ts$/],
	expand_to: 'dependencies', // Include all imported files
	on_change: async (batch) => {
		console.log('Tests and their dependencies changed:', batch.all_disknodes);
	},
});
```

### multi-phase processing

Run code generation before other processing:

```typescript
// Generate code first
filer.observe({
	id: 'codegen',
	patterns: [/\.gen\.ts$/],
	phase: 'pre',
	priority: 100,
	on_change: async (batch) => {
		await generate(batch.all_disknodes);
	},
});

// Then process everything
filer.observe({
	id: 'processor',
	patterns: [/\.ts$/],
	phase: 'main',
	on_change: async (batch) => {
		await process(batch.all_disknodes);
	},
});
```

### invalidation intents

Trigger broader changes based on specific file updates:

```typescript
filer.observe({
	id: 'config-watcher',
	paths: ['./gro.config.ts'],
	returns_intents: true,
	on_change: async (batch) => {
		await reloadConfig();
		// Invalidate all TypeScript files when config changes
		return [
			{
				type: 'pattern',
				pattern: /\.ts$/,
			},
		];
	},
});
```

### dynamic path watching

Watch paths that change at runtime:

```typescript
filer.observe({
	id: 'dynamic-watcher',
	paths: () => getActivePaths(), // Function called on each batch
	on_change: async (batch) => {
		// Only processes files matching current dynamic paths
	},
});
```

### querying the filesystem

Find files matching specific criteria:

```typescript
// Find all test files
const test_files = filer.find_disknodes((disknode) => disknode.id.includes('.test.'));

// Get a specific disknode
const disknode = filer.get_disknode('/path/to/module.ts');

// Get disknode from active or tombstone cache
const maybe_deleted = filer.get_by_id('/path/to/file.ts');

// Get all files that import a specific module
const importers = filer.get_dependents(disknode);

// Get all dependencies of a file
const deps = filer.get_dependencies(disknode);

// Filter dependents with a predicate
const ts_dependents = filer.filter_dependents(
	disknode,
	(id) => id.endsWith('.ts'),
	true, // recursive
);

// Traverse relationships lazily
for (const dep of filer.traverse_relationships(disknode, 'dependents')) {
	console.log(dep.id);
}
```

### working with disknodes

```typescript
const disknode = filer.get_disknode('/src/module.ts');

// File properties (lazy-loaded and cached)
console.log(disknode.contents); // File contents
console.log(disknode.stats); // File stats
console.log(disknode.mtime); // Modified time
console.log(disknode.size); // File size
console.log(disknode.realpath); // Resolved path for symlinks
console.log(disknode.imports); // Parsed ES imports

// File type checks
if (disknode.is_typescript) {
	/* ... */
}
if (disknode.is_js) {
	/* ... */
}
if (disknode.is_svelte) {
	/* ... */
}
if (disknode.is_svelte_module) {
	/* .svelte.ts or .svelte.js */
}
if (disknode.is_importable) {
	/* ... */
}

// Node state
console.log(disknode.kind); // 'file' | 'directory' | 'symlink'
console.log(disknode.exists); // false when deleted but still referenced
console.log(disknode.is_external); // true if outside watched paths

// Tree navigation
const parent = disknode.parent;
const child = disknode.get_child('submodule.ts');
const ancestors = disknode.get_ancestors();
const descendants = disknode.get_descendants();

// Check relationships
if (parent?.is_ancestor_of(disknode)) {
	const relative = disknode.relative_to(parent); // e.g., "src/lib/file.ts"
}

// Manual cache invalidation
disknode.invalidate(); // Clear all cached properties
```

### manual operations

```typescript
// Queue a disknode for dependency update
filer.queue_dependency_update(disknode);

// Force rescan a directory tree
await filer.rescan_subtree('/src/lib');

// Pre-load stats for all files
await filer.load_initial_stats();

// Reset watcher with new paths
await filer.reset_watcher(['/new/path'], {
	// Chokidar options
});
```

## why

### problems with traditional file watching

- **scattered watchers** - each tool maintains its own file watcher,
  leading to duplicated effort and inconsistent behavior
- **no dependency tracking** - changes don't propagate through the import graph,
  requiring manual configuration or over-broad watching
- **async everywhere** - reading files requires async calls throughout your code,
  making simple operations complex
- **no coordination** - multiple watchers can race or conflict when processing the same files

### how Filer solves these

- **single source of truth** - one filesystem mirror shared by all tools
- **automatic dependency tracking** - import statements are parsed and tracked,
  so changes propagate correctly
- **synchronous lazy loading** - file contents and stats are cached and available synchronously,
  loaded on first access
- **coordinated observers** - changes are batched and processed in phases,
  preventing races and ensuring consistency

## api

### Filer

The `Filer` orchestrates the filesystem mirror and observer system:

```typescript
class Filer {
	// Core state
	readonly disknodes: Map<Path_Id, Disknode>; // All tracked files
	readonly tombstones: Map<Path_Id, Disknode>; // Deleted disknodes cache with FIFO eviction
	readonly roots: Set<Disknode>; // Top-level watched paths
	tombstone_limit: number; // Maximum tombstones to keep (default: 500)
	batch_size: number; // Parallel operations batch size (default: 100)

	constructor(options?: {
		batch_delay?: number; // Ms to batch changes (default: 10)
		observers?: Iterable<Filer_Observer>; // Initial observers
		log?: Logger;
		aliases?: Array<[string, string]>; // Import alias mappings
		resolve_external_specifier?: (specifier: string, base: string) => string; // Custom resolver
	});

	// Lifecycle
	mount(paths?: Array<string>, chokidar_options?: ChokidarOptions): Promise<void>; // Start watching
	reset_watcher(paths: Array<string>, chokidar_options?: ChokidarOptions): Promise<void>; // Reset with new paths
	dispose(): Promise<void>; // Cleanup

	// Observer management
	observe(observer: Filer_Observer): () => void; // Returns unsubscribe

	// Disknode access
	get_disknode(id: Path_Id): Disknode; // Get or create
	get_by_id(id: Path_Id): Disknode | undefined; // Get from active disknodes or tombstones
	find_disknodes(predicate: (disknode: Disknode) => boolean): Array<Disknode>;

	// Dependency traversal
	get_dependents(disknode: Disknode, recursive?: boolean): Set<Disknode>;
	get_dependencies(disknode: Disknode, recursive?: boolean): Set<Disknode>;
	filter_dependents(
		disknode: Disknode,
		filter?: (id: Path_Id) => boolean,
		recursive?: boolean,
	): Set<Path_Id>;
	traverse_relationships(
		disknode: Disknode,
		type: 'dependents' | 'dependencies',
		recursive?: boolean,
	): Generator<Disknode>;

	// Internal operations (used by Disknode)
	map_alias(specifier: string): string; // Apply import aliases
	resolve_specifier(specifier: string, base: Path_Id): {path_id: Path_Id};
	resolve_external_specifier(specifier: string, base: string): string;
	parse_imports(id: Path_Id, contents: string, ignore_types?: boolean): Array<string>;
	queue_dependency_update(disknode: Disknode): void; // Queue for import parsing

	// Manual operations
	rescan_subtree(path: string): Promise<void>; // Force rescan
	load_initial_stats(): Promise<void>; // Pre-warm stat cache
}
```

### Disknode

A `Disknode` represents a file or directory in the filesystem.
All properties are lazy-loaded and cached based on a version counter.

```typescript
class Disknode {
	// Core properties
	readonly id: Path_Id; // Absolute path
	readonly api: Disknode_Api; // Parent filer interface
	kind: 'file' | 'directory' | 'symlink';
	is_external: boolean; // Outside watched paths
	exists: boolean; // False when deleted but still referenced

	// Version tracking (for cache invalidation)
	get version(): number; // Current cache version
	get stats_version(): number; // Version when stats were loaded
	get contents_version(): number; // Version when contents were loaded
	get realpath_version(): number; // Version when realpath was resolved
	get imports_version(): number; // Version when imports were parsed

	// Lazy-loaded properties (synchronous)
	get stats(): Stats | null; // File stats
	get contents(): string | null; // File contents (null for dirs, large files bypass cache)
	get realpath(): Path_Id; // Resolved path for symlinks
	get imports(): Set<string> | null; // Parsed ES imports (auto-updates dependencies)

	// Computed properties
	get mtime(): number | null;
	get size(): number | null;
	get extension(): string; // File extension including dot
	get is_typescript(): boolean; // .ts, .mts, .cts files
	get is_js(): boolean; // .js, .mjs, .cjs files
	get is_svelte(): boolean; // .svelte files
	get is_svelte_module(): boolean; // .svelte.ts or .svelte.js files
	get is_importable(): boolean; // Any importable file type

	// Relationships
	parent: Disknode | null;
	children: Map<string, Disknode>; // For directories (keyed by basename)
	dependencies: Map<Path_Id, Disknode>; // What this imports
	dependents: Map<Path_Id, Disknode>; // What imports this

	// Methods
	invalidate(): void; // Clear caches
	set_stats(value: Stats): void; // Set stats to avoid syscalls
	set_stats_force(value: Stats): void; // Force set stats (bypasses version check)
	add_dependency(dep: Disknode): void;
	remove_dependency(dep: Disknode): void;
	clear_relationships(): void; // Remove all deps/dependents
	get_ancestors(): Array<Disknode>;
	get_descendants(): Array<Disknode>;
	get_child(name: string): Disknode | undefined;
	is_ancestor_of(disknode: Disknode): boolean;
	relative_to(disknode: Disknode): string | null; // Path from this to target
	relative_from(disknode: Disknode): string | null; // Path from target to this
}
```

### Disknode_Api

Interface that Disknode uses to communicate with its parent Filer:

```typescript
interface Disknode_Api {
	map_alias(specifier: string): string;
	resolve_specifier(specifier: string, base: Path_Id): {path_id: Path_Id};
	resolve_external_specifier(specifier: string, base: string): string;
	get_disknode(id: Path_Id): Disknode;
	parse_imports(id: Path_Id, contents: string, ignore_types?: boolean): Array<string>;
}
```

### Filer_Observer

Observers declare what files they care about and how to respond to changes:

```typescript
interface Filer_Observer {
	id: string; // Unique identifier

	// Matching strategies (at least one required)
	patterns?: Array<RegExp>; // Match file paths by regex
	paths?: Array<string> | (() => Array<string>); // Specific paths (can be dynamic - should be pure and cheap)
	match?: (disknode: Disknode) => boolean; // Custom matching logic

	// What to track
	track_external?: boolean; // Include files outside watched paths (default: false)
	track_directories?: boolean; // Include directory changes (default: false)

	// Batch expansion
	expand_to?: 'self' | 'dependents' | 'dependencies' | 'all'; // How to expand matched files

	// Intent support
	returns_intents?: boolean; // Can return invalidation intents (default: false)

	// Performance hints
	needs_contents?: boolean; // Pre-load file contents (default: false)
	needs_stats?: boolean; // Pre-load stats (default: true)
	needs_imports?: boolean; // Parse imports for dependency tracking (default: auto-detected)

	// Execution control
	phase?: 'pre' | 'main' | 'post'; // When to run (default: 'main')
	priority?: number; // Higher runs first within phase (default: 0)
	timeout_ms?: number; // Max execution time (default: 30000)
	on_error?: (error: Error, batch: Filer_Change_Batch) => 'continue' | 'abort';

	// Handler
	on_change: (
		batch: Filer_Change_Batch,
	) => void | Array<Filer_Invalidation_Intent> | Promise<void | Array<Filer_Invalidation_Intent>>;
}
```

### Filer_Change_Batch

Batches related filesystem changes into atomic units:

```typescript
class Filer_Change_Batch {
	readonly changes: Map<Path_Id, Filer_Change>;

	// Convenience accessors
	get added(): Array<Disknode>; // Newly created files
	get updated(): Array<Disknode>; // Modified files
	get deleted(): Array<Path_Id>; // Removed file IDs
	get all_disknodes(): Array<Disknode>; // All added + updated
	get size(): number;
	get is_empty(): boolean;

	// Query methods
	has(id: Path_Id): boolean;
	get(id: Path_Id): Filer_Change | undefined;
}
```

### Filer_Change

Individual change record in a batch:

```typescript
interface Filer_Change {
	type: 'add' | 'update' | 'delete';
	disknode?: Disknode; // Present for add/update
	id: Path_Id;
	kind: 'file' | 'directory' | 'symlink';
}
```

### Filer_Invalidation_Intent

Observers can return intents to trigger additional invalidations:

```typescript
interface Filer_Invalidation_Intent {
	type: 'all' | 'paths' | 'pattern' | 'dependents' | 'dependencies' | 'subtree';
	paths?: Array<string>; // For 'paths' type
	pattern?: RegExp; // For 'pattern' type
	disknode?: Disknode; // For 'dependents'/'dependencies'/'subtree' types
	include_self?: boolean; // For 'subtree' type (default: false)
}
```

### Helper Types

Additional types used throughout the system:

```typescript
type Path_Id = string; // Absolute filesystem path
type Filer_Phase = 'pre' | 'main' | 'post';
type Filer_Expand_Strategy = 'self' | 'dependents' | 'dependencies' | 'all';
type Filer_Error_Strategy = 'continue' | 'abort';
type Filer_Node_Kind = 'file' | 'directory' | 'symlink';
type Filer_Change_Type = 'add' | 'update' | 'delete';
```

### Filer_Options

Configuration options for creating a Filer:

```typescript
interface Filer_Options {
	batch_delay?: number; // Delay for batching changes in ms (default: 10)
	observers?: Iterable<Filer_Observer>; // Initial observers to register
	log?: Logger; // Logger instance for debugging
	aliases?: Array<[string, string]>; // Import alias mappings (e.g., ['$lib', '/src/lib'])
	resolve_external_specifier?: (specifier: string, base: string) => string; // Custom resolver (default: import.meta.resolve)
}
```

## design

### path matching behavior

Observer `paths` arrays perform **exact path matching only**. If you specify `paths: ['/src']`,
it will only match the exact path `/src` and **not** files within that directory like `/src/file.ts`.

This explicit behavior was chosen over implicit directory descendant matching for several reasons:

#### why exact matching only?

- **Predictable behavior**: `paths: ['/src']` has clear, unambiguous semantics
- **Avoid conceptual confusion**: Keeps `paths` and `patterns` behaviors distinct
- **Performance**: No additional filesystem checks or string comparisons per path
- **Explicit over implicit**: Users must be intentional about what they match

#### alternatives for directory matching

If you want to watch all files in a directory, use one of these approaches:

```typescript
// Option 1: Use patterns with regex
filer.observe({
	id: 'directory-watcher',
	patterns: [/^\/src\//], // Matches /src/file.ts, /src/lib/util.ts, etc.
	on_change: (batch) => {
		/* ... */
	},
});

// Option 2: Use custom match function
filer.observe({
	id: 'directory-watcher',
	match: (disknode) => disknode.id.startsWith('/src/'),
	on_change: (batch) => {
		/* ... */
	},
});

// Option 3: Combine exact path with patterns
filer.observe({
	id: 'mixed-watcher',
	paths: ['/src/index.ts'], // Exact file
	patterns: [/^\/src\/lib\//], // Directory contents
	on_change: (batch) => {
		/* ... */
	},
});
```

### lazy synchronous loading

Disknode properties like `contents` and `stats` are loaded synchronously on first access.
This keeps the API simple without async contagion, and values are cached until invalidated.

```typescript
const disknode = filer.get_disknode('/path/to/file.ts');
console.log(disknode.contents); // Synchronously reads and caches file
console.log(disknode.stats); // Synchronously stats and caches
disknode.invalidate(); // Clear caches, next access will reload
```

**Note**: Synchronous operations block the Node.js event loop. For performance-critical applications,
consider pre-warming caches asynchronously or processing in batches.

### version-based cache invalidation

Each Disknode has an internal version counter that increments on changes.
Cached properties track which version they were loaded at:

```typescript
// Internally, Disknode does something like:
get contents(): string | null {
	if (this.#contents_version !== this.#version) {
		this.#contents = readFileSync(this.id, 'utf8');
		this.#contents_version = this.#version;
	}
	return this.#contents;
}
```

### automatic dependency tracking

When you access `disknode.imports`, it parses the file's import statements
and automatically updates the dependency graph:

```typescript
const disknode = filer.get_disknode('/src/module.ts');
const imports = disknode.imports; // Parses imports and updates dependencies
// Now disknode.dependencies contains all imported modules
// And those modules' dependents include this disknode
```

**Note**: The `imports` getter has side effects (updating the dependency graph).
This is intentional to keep the graph consistent but may be unexpected.

### batch processing and change coalescing

Changes are batched to reduce processing overhead and properly coalesce rapid changes:

- **add + update → add** (preserve the add semantic)
- **add + delete → remove entirely** (file created and deleted in same batch)
- **delete + add → update** (file was recreated)
- **update + update → update** (multiple saves)
- **delete + delete → delete** (shouldn't happen but handled)

The coalescing uses a lookup table for O(1) transition resolution.

### invalidation flow

The invalidation flow demonstrates how filesystem changes propagate through the system:

```
┌────────────────────────────────────────────────────────────────────┐
│                      Filesystem Event Triggers                      │
└────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────┐
│                     1. Filesystem Change Event                      │
│  • File added/updated/deleted                                       │
│  • Chokidar emits 'add'/'change'/'unlink' event                    │
│  • Event captured by Filer.#handle_change()                        │
└────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────┐
│                    2. Disknode Cache Invalidation                   │
│  • disknode.invalidate() increments version counter                 │
│  • All cached properties marked stale:                              │
│    - stats (file metadata)                                          │
│    - contents (file text)                                           │
│    - imports (parsed ES imports)                                    │
│    - realpath (symlink resolution)                                  │
│  • Next property access triggers fresh load from filesystem         │
└────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────┐
│                       3. Change Coalescing                          │
│  • Changes added to pending_changes Map                             │
│  • Multiple rapid changes coalesced (add+update→add, etc)          │
│  • Batch timer started (default 10ms delay)                         │
│  • Importable files queued for dependency update                    │
└────────────────────────────────────────────────────────────────────┘
                                    │
                            (batch delay)
                                    ▼
┌────────────────────────────────────────────────────────────────────┐
│                         4. Batch Flush                              │
│  • Timer expires, #flush_batch() called                             │
│  • Snapshot of pending_changes taken                                │
│  • Dependency graph updated if any observer needs imports           │
│    - disknode.imports getter triggered                              │
│    - Import statements parsed from fresh contents                   │
│    - Dependencies/dependents Maps updated bidirectionally           │
└────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────┐
│                      5. Observer Processing                         │
│  • Process by phase: 'pre' → 'main' → 'post'                       │
│  • Within phase, sort by priority (highest first)                   │
│                                                                      │
│  For each observer:                                                 │
│  a) Filter batch for matching files (patterns/paths/match)          │
│  b) Expand batch if needed (dependents/dependencies/all)            │
│  c) Pre-warm data based on hints (contents/stats/imports)           │
│  d) Execute observer.on_change() with timeout protection            │
│  e) Collect any returned invalidation intents                       │
└────────────────────────────────────────────────────────────────────┘
                                    │
                         (if intents returned)
                                    ▼
┌────────────────────────────────────────────────────────────────────┐
│                    6. Intent-Based Invalidation                     │
│  • Resolve intents to additional disknodes:                         │
│    - 'all': Every non-external disknode                             │
│    - 'paths': Specific file paths                                   │
│    - 'pattern': Files matching regex                                │
│    - 'dependents': All files importing target                       │
│    - 'dependencies': All files imported by target                   │
│    - 'subtree': Target and all descendants                          │
│  • Each resolved disknode gets disknode.invalidate()                │
│  • Creates new batch with 'update' changes                          │
│  • Loop prevention: Skip already-processed disknodes                │
└────────────────────────────────────────────────────────────────────┘
                                    │
                            (if new batch)
                                    ▼
┌────────────────────────────────────────────────────────────────────┐
│                    7. Iterative Batch Processing                    │
│  • Add new batch to queue (avoids deep recursion)                   │
│  • Process next batch from queue                                    │
│  • Mark all disknodes as processed (loop prevention)                │
│  • Return to step 5 for observer processing                         │
│  • Continue until queue empty                                       │
└────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────┐
│                           8. Cleanup                                │
│  • Clear relationships for deleted nodes                            │
│  • Update parent-child relationships                                │
│  • Move deleted disknodes to tombstone cache                        │
│  • FIFO eviction if tombstones exceed limit                         │
└────────────────────────────────────────────────────────────────────┘
```

### execution phases

Observers execute in three phases to ensure proper ordering:

1. **pre** - Setup and generation tasks
2. **main** - Primary processing
3. **post** - Cleanup and finalization

Within each phase, observers run by priority (highest first).

### loop prevention

The system tracks processed disknodes globally across batch rounds to prevent infinite loops
when observers trigger additional invalidations. Each disknode is only processed once per
change event cycle.

### memory management

- File contents over 10MB bypass the cache to prevent memory bloat
- External files (outside watched paths) are tracked but handled differently
- The complete filesystem mirror enables fast queries without filesystem access
- Symlink resolution is cached to avoid repeated filesystem calls
- Deleted disknodes are moved to a tombstone cache with FIFO eviction (default limit: 500)

### parent-child relationships

Disknodes maintain bidirectional parent-child relationships for efficient tree traversal:

```typescript
// Navigate the tree
const parent = disknode.parent;
const child = disknode.get_child('subfile.ts');
const ancestors = disknode.get_ancestors();
const descendants = disknode.get_descendants();

// Check relationships
if (parent.is_ancestor_of(disknode)) {
	const relative = disknode.relative_to(parent); // e.g., "src/lib/file.ts"
}
```

### dynamic path resolution

Observers can use dynamic paths that are evaluated at runtime:

```typescript
filer.observe({
	id: 'dynamic-watcher',
	paths: () => getActivePaths(), // Function called on each batch
	on_change: async (batch) => {
		// Only processes files matching current dynamic paths
	},
});
```

### import alias mapping

Filer supports TypeScript/bundler import aliases:

```typescript
const filer = new Filer({
	aliases: [
		['$lib', '/src/lib'],
		['@components', '/src/components'],
	],
});

// Now imports like `import {x} from '$lib/util'` are resolved correctly
```

### tombstone cache

Deleted disknodes are preserved in a tombstone cache for a limited time:

- Allows recovery if files are quickly recreated
- Preserves metadata for recently deleted files
- FIFO eviction when limit exceeded (configurable via `tombstone_limit`)
- Can be retrieved via `get_by_id()` but not `get_disknode()`

## performance

- **initial scan**: O(n) where n = number of files
- **change detection**: O(1) per file via filesystem events
- **dependency lookup**: O(1) via Maps
- **tree traversal**: O(descendants) or O(ancestors)
- **import parsing**: O(file_size) with caching
- **batch coalescing**: O(1) per change via lookup table
- **memory usage**: ~1KB per file + cached contents (small files only)
- **observer matching**: O(observers × patterns) per change
- **batch expansion**: O(relationships) for dependency/dependent expansion

### optimization strategies

- Pre-warm caches with `load_initial_stats()` for known hot paths
- Use `batch_size` to control parallel operation throughput
- Set appropriate `batch_delay` to balance responsiveness vs efficiency
- Limit tombstone cache size for long-running processes
- Use `needs_imports: false` for observers that don't need dependency tracking

## limitations

- **POSIX paths only**: No Windows path support currently
- **Single-threaded**: Import parsing happens on main thread (can block event loop)
- **No automatic memory management**: Very large trees may consume significant memory
- **mtime-based change detection**: No content hashing; relies on filesystem modification times
- **Symlink cycles**: Handled gracefully in realpath resolution (falls back to original path)
- **Static imports only**: Dynamic imports not tracked for dependency graph
- **Type-only validation**: Function and complex object validation is compile-time only (no runtime Zod validation)
- **Synchronous I/O**: All file operations are synchronous and block the event loop
- **No partial file watching**: Cannot watch specific parts of large files
- **No network filesystem support**: May have issues with NFS or other network-mounted filesystems

## error-handling

### observer errors

Observers can control error handling behavior:

```typescript
filer.observe({
	id: 'error-aware-observer',
	patterns: [/\.ts$/],
	on_error: (error, batch) => {
		console.error('Observer error:', error);
		return 'continue'; // or 'abort' to stop batch processing
	},
	on_change: async (batch) => {
		// May throw errors
	},
});
```

### timeout protection

Observers have configurable timeouts (default: 30 seconds):

```typescript
filer.observe({
	id: 'long-running',
	patterns: [/\.ts$/],
	timeout_ms: 60000, // 1 minute timeout
	on_change: async (batch) => {
		// Long-running operation
	},
});
```

### filesystem errors

- Non-existent files return `null` for contents/stats
- Broken symlinks fall back to original path
- Import resolution failures are silently skipped (dependencies not added)
- Filesystem read errors during lazy loading return `null`

### state management

- Cannot mount an already mounted filer
- Cannot mount a disposed filer
- Operations on unmounted filer throw errors
- Duplicate observer IDs throw errors
