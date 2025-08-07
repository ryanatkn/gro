# filer

> complete in-memory filesystem mirror with dependency tracking for
> [Gro](https://github.com/ryanatkn/gro)

## contents

- [what](#what)
- [usage](#usage)
- [why](#why)
- [architecture](#architecture)
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

The system is built from focused, composable components:

- **`Disknode`** - represents a file or directory with lazy-loaded properties
- **`Disknodes`** - manages the collection of disknodes and filesystem tree
- **`Dependency_Graph`** - tracks import relationships between files
- **`Import_Resolver`** - resolves and caches import specifiers
- **`Filer`** - orchestrates all components and provides the main API

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

### custom components

Provide your own component implementations:

```typescript
// Use custom import resolution
class Custom_Import_Resolver extends Import_Resolver {
	resolve(specifier: string, base: Path_Id): Import_Resolution_Result {
		// Custom resolution logic
		return super.resolve(specifier, base);
	}
}

// Create filer with custom components
const filer = new Filer({
	imports: new Custom_Import_Resolver(),
	// Other components created automatically
});

// Or customize multiple components
const filer = new Filer({
	disknodes: new Custom_Disknodes(),
	dependencies: new Custom_Dependency_Graph(),
	imports: new Custom_Import_Resolver(),
});
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

// Disknode state
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
- **modular architecture** - focused components that can be customized or replaced

## architecture

The refactored architecture separates concerns into focused, single-responsibility components:

```
Filer (orchestrator)
├── Disknodes (collection of disknodes & filesystem tree)
│   ├── Disknode (individual file/directory)
│   └── Disknode_Tombstones (deleted disknode cache)
├── Dependency_Graph (pure import relationships)
├── Import_Resolver (import resolution & caching)
├── Filer_Change_Watcher (filesystem monitoring)
├── Filer_Change_Batcher (change coalescing)
└── Filer_Observers (observer collection & execution)
```

### component responsibilities

| Component                | Responsibility                       | Key Features                        |
| ------------------------ | ------------------------------------ | ----------------------------------- |
| **Disknode**             | Single file/directory representation | Lazy loading, version-based caching |
| **Disknodes**            | Collection management                | Tree operations, tombstone cache    |
| **Dependency_Graph**     | Import relationship tracking         | Cycle detection, traversal          |
| **Import_Resolver**      | Specifier resolution                 | Alias mapping, caching              |
| **Filer_Change_Watcher** | Filesystem monitoring                | Event handling, path tracking       |
| **Filer_Change_Batcher** | Change batching                      | Coalescing, delay management        |
| **Filer_Observers**      | Observer management                  | Phase execution, intent handling    |
| **Filer**                | Orchestration                        | Component coordination, public API  |

### dependency injection

All components follow a consistent pattern: they create their own dependencies by default
but can accept custom implementations via options:

```typescript
// Zero configuration - everything created automatically
const filer = new Filer();

// Custom components - provide your own implementations
const filer = new Filer({
	disknodes: new Custom_Disknodes(),
	imports: new Custom_Import_Resolver(),
	// Other components created with defaults
});

// Components only need to implement the expected interface
class Custom_Import_Resolver extends Import_Resolver {
	resolve(specifier: string, base: Path_Id): Import_Resolution_Result {
		// Custom logic
		return super.resolve(specifier, base);
	}
}
```

## api

### Filer

The main orchestrator that coordinates all components:

```typescript
class Filer {
	// Configuration options
	constructor(options?: Filer_Options);

	// Core API
	mount(paths?: Array<string>, options?: ChokidarOptions): Promise<void>;
	dispose(): Promise<void>;
	observe(observer: Filer_Observer): () => void; // Returns unsubscribe

	// Disknode access
	get_disknode(id: Path_Id): Disknode;
	get_by_id(id: Path_Id): Disknode | undefined;
	find_disknodes(predicate: (disknode: Disknode) => boolean): Array<Disknode>;

	// Dependency queries
	get_dependencies(disknode: Disknode, recursive?: boolean): Set<Disknode>;
	get_dependents(disknode: Disknode, recursive?: boolean): Set<Disknode>;
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

	// Manual operations
	queue_dependency_update(disknode: Disknode): void;
	rescan_subtree(path: string): Promise<void>;
	load_initial_stats(): Promise<void>;
	reset_watcher(paths: Array<string>, options?: ChokidarOptions): Promise<void>;
}

interface Filer_Options {
	// Custom components (all optional)
	disknodes?: Disknodes;
	dependencies?: Dependency_Graph;
	imports?: Import_Resolver;
	watcher?: Filer_Change_Watcher;
	batcher?: Filer_Change_Batcher;
	observers?: Filer_Observers;

	// Configuration for default components
	batch_delay?: number; // Ms to batch changes (default: 10)
	tombstone_limit?: number; // Max tombstones (default: 500)
	aliases?: Array<[string, string]>; // Import aliases
	initial_observers?: Iterable<Filer_Observer>; // Initial observers
	log?: Logger; // Logger instance
}
```

### Disknode

Represents a single file or directory:

```typescript
class Disknode {
	// Identity
	readonly id: Path_Id;
	kind: Disknode_Kind; // 'file' | 'directory' | 'symlink'
	exists: boolean;
	is_external: boolean;

	// Lazy-loaded properties
	get stats(): Stats | null;
	get contents(): string | null;
	get imports(): Set<string> | null;
	get realpath(): Path_Id;

	// Computed properties
	get mtime(): number | null;
	get size(): number | null;
	get extension(): string;
	get is_typescript(): boolean;
	get is_js(): boolean;
	get is_svelte(): boolean;
	get is_svelte_module(): boolean;
	get is_importable(): boolean;

	// Relationships
	parent: Disknode | null;
	readonly children: Map<string, Disknode>;

	// Methods
	invalidate(): void;
	get_ancestors(): Array<Disknode>;
	get_descendants(): Array<Disknode>;
	get_child(name: string): Disknode | undefined;
	is_ancestor_of(disknode: Disknode): boolean;
	relative_to(disknode: Disknode): string | null;
	relative_from(disknode: Disknode): string | null;
}
```

### Disknodes

Manages the collection of disknodes:

```typescript
class Disknodes {
	constructor(options?: Disknodes_Options);

	// Disknode management
	get_disknode(id: Path_Id): Disknode;
	create_disknode(id: Path_Id): Disknode;
	delete_disknode(id: Path_Id): void;

	// Tree operations
	get_roots(): Set<Disknode>;
	get_subtree(root: Disknode): Set<Disknode>;
	get_ancestors(disknode: Disknode): Array<Disknode>;
	get_descendants(disknode: Disknode): Array<Disknode>;

	// Queries
	find(predicate: (disknode: Disknode) => boolean): Array<Disknode>;
}

interface Disknodes_Options {
	tombstone_limit?: number;
	dependencies?: Dependency_Graph;
	imports?: Import_Resolver;
}
```

### Dependency_Graph

Pure graph structure for tracking import relationships:

```typescript
class Dependency_Graph {
	// Edge management
	add_edge(from: Path_Id, to: Path_Id): void;
	remove_edge(from: Path_Id, to: Path_Id): void;
	clear_edges_for(id: Path_Id): void;

	// Traversal
	get_dependencies(id: Path_Id, recursive?: boolean): Set<Path_Id>;
	get_dependents(id: Path_Id, recursive?: boolean): Set<Path_Id>;

	// Analysis
	detect_cycles(): Array<Array<Path_Id>>;
	get_roots(): Set<Path_Id>;
	get_leaves(): Set<Path_Id>;
}
```

### Import_Resolver

Handles import resolution and caching:

```typescript
class Import_Resolver {
	constructor(options?: Import_Resolver_Options);

	// Resolution
	resolve(specifier: string, base: Path_Id): Import_Resolution_Result;
	map_alias(specifier: string): string;

	// Cache management
	invalidate_cache(pattern?: RegExp): void;

	// Batch operations
	batch_resolve(requests: Array<Import_Request>): Map<string, Import_Resolution_Result>;
}

interface Import_Resolver_Options {
	aliases?: Array<[string, string]>;
	external_resolver?: (specifier: string, base: string) => string;
}

interface Import_Resolution_Result {
	path_id: Path_Id | null;
	is_external: boolean;
	is_builtin: boolean;
	error?: string;
}
```

### Filer_Observer

Observer configuration for watching changes:

```typescript
interface Filer_Observer {
	id: string;

	// Matching strategies
	patterns?: Array<RegExp>;
	paths?: Array<string> | (() => Array<string>);
	match?: (disknode: Disknode) => boolean;

	// Options
	track_external?: boolean;
	track_directories?: boolean;
	expand_to?: 'self' | 'dependents' | 'dependencies' | 'all';
	returns_intents?: boolean;

	// Performance hints
	needs_contents?: boolean;
	needs_stats?: boolean;
	needs_imports?: boolean;

	// Execution control
	phase?: 'pre' | 'main' | 'post';
	priority?: number;
	timeout_ms?: number;
	on_error?: (error: Error, batch: Filer_Change_Batch) => 'continue' | 'abort';

	// Handler
	on_change: (
		batch: Filer_Change_Batch,
	) => void | Array<Filer_Invalidation_Intent> | Promise<void | Array<Filer_Invalidation_Intent>>;
}
```

### Filer_Change_Batch

Batched filesystem changes:

```typescript
class Filer_Change_Batch {
	readonly changes: Map<Path_Id, Filer_Change>;

	get added(): Array<Disknode>;
	get updated(): Array<Disknode>;
	get deleted(): Array<Path_Id>;
	get all_disknodes(): Array<Disknode>;
	get size(): number;
	get is_empty(): boolean;

	has(id: Path_Id): boolean;
	get(id: Path_Id): Filer_Change | undefined;
}
```

### Helper Types

```typescript
type Path_Id = string; // Absolute filesystem path
type Disknode_Kind = 'file' | 'directory' | 'symlink';
type Filer_Phase = 'pre' | 'main' | 'post';
type Filer_Expand_Strategy = 'self' | 'dependents' | 'dependencies' | 'all';
type Filer_Change_Type = 'add' | 'update' | 'delete';

interface Filer_Change {
	type: Filer_Change_Type;
	disknode?: Disknode;
	id: Path_Id;
	kind: Disknode_Kind;
}

interface Filer_Invalidation_Intent {
	type: 'all' | 'paths' | 'pattern' | 'dependents' | 'dependencies' | 'subtree';
	paths?: Array<string>;
	pattern?: RegExp;
	disknode?: Disknode;
	include_self?: boolean;
}
```

## design

### path matching behavior

Observer `paths` arrays perform **exact path matching only**. If you specify `paths: ['/src']`,
it will only match the exact path `/src` and **not** files within that directory like `/src/file.ts`.

This explicit behavior provides:

- **Predictable behavior**: Clear, unambiguous semantics
- **Distinct from patterns**: Different behavior for different use cases
- **Performance**: No additional filesystem checks per path
- **Explicit intent**: Users must be intentional about matches

For directory watching, use patterns or custom match functions:

```typescript
// Watch directory contents with pattern
filer.observe({
	id: 'dir-watcher',
	patterns: [/^\/src\//], // Matches /src/file.ts, /src/lib/util.ts, etc.
	on_change: (batch) => {
		/* ... */
	},
});

// Or use custom match function
filer.observe({
	id: 'dir-watcher',
	match: (disknode) => disknode.id.startsWith('/src/'),
	on_change: (batch) => {
		/* ... */
	},
});
```

### lazy synchronous loading

Disknode properties are loaded synchronously on first access and cached:

```typescript
const disknode = filer.get_disknode('/path/to/file.ts');
console.log(disknode.contents); // Synchronously reads and caches
console.log(disknode.stats); // Synchronously stats and caches
disknode.invalidate(); // Clear caches, next access will reload
```

**Note**: Synchronous operations block the event loop. Consider pre-warming caches
or processing in batches for performance-critical applications.

### version-based cache invalidation

Each Disknode uses an internal version counter for cache invalidation.
When invalidated, the version increments and cached properties are reloaded on next access.

### automatic dependency tracking

Accessing `disknode.imports` automatically updates the dependency graph:

```typescript
const disknode = filer.get_disknode('/src/module.ts');
const imports = disknode.imports; // Parses imports and updates graph
// Dependencies are now tracked bidirectionally
```

### batch processing and coalescing

Changes are batched and coalesced for efficiency:

| First Change | Second Change | Result    |
| ------------ | ------------- | --------- |
| add          | update        | add       |
| add          | delete        | (removed) |
| delete       | add           | update    |
| update       | update        | update    |

### execution phases

Observers execute in three phases with priority ordering:

1. **pre** - Setup and generation (highest priority first)
2. **main** - Primary processing (highest priority first)
3. **post** - Cleanup and finalization (highest priority first)

### memory management

- Files over 10MB bypass the cache
- Deleted disknodes move to tombstone cache (FIFO eviction)
- Symlink resolution is cached
- Import resolution results are cached

### component modularity

Each component can be tested and developed independently:

```typescript
// Test dependency graph in isolation
const graph = new Dependency_Graph();
graph.add_edge('/a.ts', '/b.ts');
graph.add_edge('/b.ts', '/c.ts');
graph.add_edge('/c.ts', '/a.ts');
expect(graph.detect_cycles()).toHaveLength(1);

// Test batcher without filesystem
const batcher = new Filer_Change_Batcher();
batcher.add_change({type: 'add', id: '/a.ts'});
batcher.add_change({type: 'delete', id: '/a.ts'});
batcher.flush(); // Coalesces to nothing
```

## performance

### complexity

| Operation         | Complexity              | Notes                    |
| ----------------- | ----------------------- | ------------------------ |
| Initial scan      | O(n)                    | n = number of files      |
| Change detection  | O(1)                    | Per file via events      |
| Dependency lookup | O(1)                    | Via Maps                 |
| Tree traversal    | O(nodes)                | Descendants or ancestors |
| Import parsing    | O(file_size)            | With caching             |
| Batch coalescing  | O(1)                    | Via lookup table         |
| Observer matching | O(observers × patterns) | Per change               |

### memory usage

- ~1KB per disknode (metadata only)
- File contents cached for files under 10MB
- Tombstone cache limited by configuration
- Import resolution cache (no eviction by default, LRU can be added)

### optimization strategies

- Pre-warm caches with `load_initial_stats()`
- Configure appropriate `batch_delay` for your use case
- Use `needs_imports: false` when dependency tracking not needed
- Limit tombstone cache for long-running processes
- Provide custom components for specialized behavior

## limitations

- **POSIX paths only**: No Windows path support currently
- **Single-threaded**: Import parsing on main thread
- **No automatic memory management**: Large trees may consume significant memory
- **mtime-based changes**: No content hashing
- **Static imports only**: Dynamic imports not tracked
- **Synchronous I/O**: File operations block event loop
- **No partial file watching**: Cannot watch parts of large files
- **No network filesystem support**: May have issues with NFS

## error-handling

### observer errors

Control error behavior per observer:

```typescript
filer.observe({
	id: 'resilient-observer',
	patterns: [/\.ts$/],
	on_error: (error, batch) => {
		console.error('Observer error:', error);
		return 'continue'; // or 'abort' to stop batch
	},
	on_change: async (batch) => {
		// May throw errors
	},
});
```

### timeout protection

Observers have configurable timeouts:

```typescript
filer.observe({
	id: 'long-runner',
	timeout_ms: 60000, // 1 minute
	on_change: async (batch) => {
		// Long operation
	},
});
```

### filesystem errors

- Non-existent files return `null` for contents/stats
- Broken symlinks fall back to original path
- Import resolution failures skip dependency
- Read errors return `null`

### state management

- Cannot mount already mounted filer
- Cannot mount disposed filer
- Operations on unmounted filer throw errors
- Duplicate observer IDs overwrite previous observer
