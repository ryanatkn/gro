# filer

> complete in-memory filesystem mirror with dependency tracking for
> [Gro](https://github.com/ryanatkn/gro)

## contents

- [what](#what)
- [usage](#usage)
- [why](#why)
- [api](#api)
- [design](#design)

## what

The Filer system provides a complete in-memory mirror of your filesystem
with automatic dependency tracking and efficient change propagation.
It's the foundation for Gro's build tools, enabling features like incremental builds,
dependency-aware test running, and coordinated code generation.

Filer has two main parts:

- **`Disknode`** - represents a file or directory with lazy-loaded properties
  and automatic import dependency tracking
- **`Filer`** - orchestrates the filesystem mirror, batches changes,
  and notifies observers when files change

Think of it as a smart, shared filesystem cache that understands your code's structure
and relationships, eliminating the need for each tool to maintain its own file watcher

## usage

### basic file watching

Watch TypeScript files and react to changes:

```typescript
import {Filer} from '@ryanatkn/gro/filer.js';

const filer = new Filer();
await filer.ready; // Wait for initial filesystem scan

filer.observe({
	id: 'typescript-compiler',
	patterns: [/\.ts$/],
	on_change: async (batch) => {
		for (const disknode of batch.updated) {
			await compile(disknode);
		}
	},
});

filer.dispose(); // clean up when done
```

### dependency-aware watching

Automatically re-run tests when their dependencies change:

```typescript
filer.observe({
	id: 'test-runner',
	patterns: [/\.test\.ts$/],
	expand_to: 'dependencies', // Include all imported files
	on_change: async (batch) => {
		await runTests(batch.all_disknodes);
	},
});
```

### multi-phase processing

Run code generation before compilation:

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

// Then compile everything
filer.observe({
	id: 'compiler',
	patterns: [/\.ts$/],
	phase: 'main',
	on_change: async (batch) => {
		await compile(batch.all_disknodes);
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

### querying the filesystem

Find files matching specific criteria:

```typescript
// Find all test files
const test_files = filer.find_disknodes((disknode) => disknode.id.includes('.test.'));

// Get all files that import a specific module
const target = filer.get_disknode('/path/to/module.ts');
const importers = filer.get_dependents(target);

// Get all dependencies of a file
const deps = filer.get_dependencies(target);
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

### Disknode

A `Disknode` represents a file or directory in the filesystem.
All properties are lazy-loaded and cached based on a version counter.

```typescript
class Disknode {
	// Core properties
	readonly id: Path_Id; // Absolute path
	kind: 'file' | 'directory' | 'symlink';
	is_external: boolean; // Outside watched paths
	exists: boolean; // False when deleted but still referenced

	// Lazy-loaded properties (synchronous)
	get stats(): Stats | null; // File stats
	get contents(): string | null; // File contents (null for dirs, large files bypass cache)
	get realpath(): Path_Id; // Resolved path for symlinks
	get imports(): Set<string> | null; // Parsed ES imports (auto-updates dependencies)

	// Computed properties
	get mtime(): number | null;
	get size(): number | null;
	get extension(): string;
	get is_typescript(): boolean;
	get is_js(): boolean;
	get is_svelte(): boolean;
	get is_importable(): boolean;

	// Relationships
	parent: Disknode | null;
	children: Map<string, Disknode>; // For directories
	dependencies: Map<Path_Id, Disknode>; // What this imports
	dependents: Map<Path_Id, Disknode>; // What imports this

	// Methods
	invalidate(): void; // Clear caches
	add_dependency(dep: Disknode): void;
	remove_dependency(dep: Disknode): void;
	get_ancestors(): Array<Disknode>;
	get_descendants(): Array<Disknode>;
	relative_to(disknode: Disknode): string | null;
}
```

### Filer

The `Filer` orchestrates the filesystem mirror and observer system:

```typescript
class Filer {
	// Core state
	readonly disknodes: Map<Path_Id, Disknode>; // All tracked files
	readonly roots: Set<Disknode>; // Top-level watched paths
	readonly ready: Promise<void>; // Resolves when watcher is initialized

	constructor(options?: {
		paths?: Array<string>; // Paths to watch (default: source + configs)
		batch_delay?: number; // Ms to batch changes (default: 10)
		observers?: Array<Filer_Observer>; // Initial observers
		log?: Logger;
		aliases?: Array<[string, string]>; // Import alias mappings
		chokidar_options?: ChokidarOptions;
	});

	// Observer management
	observe(observer: Filer_Observer): () => void; // Returns unsubscribe

	// Disknode access
	get_disknode(id: Path_Id): Disknode; // Get or create
	get_by_id(id: Path_Id): Disknode | undefined;
	find_disknodes(predicate: (disknode: Disknode) => boolean): Array<Disknode>;

	// Dependency traversal
	get_dependents(disknode: Disknode, recursive?: boolean): Set<Disknode>;
	get_dependencies(disknode: Disknode, recursive?: boolean): Set<Disknode>;
	filter_dependents(
		disknode: Disknode,
		filter?: (id: Path_Id) => boolean,
		recursive?: boolean,
	): Set<Path_Id>;

	// Utilities
	map_alias(specifier: string): string; // Apply import aliases
	rescan_subtree(path: string): Promise<void>; // Force rescan
	load_initial_stats(): Promise<void>; // Pre-warm stat cache
	reset_watcher(paths: Array<string>, options?: ChokidarOptions): Promise<void>;
	close(): Promise<void>; // Cleanup
}
```

### Filer_Observer

Observers declare what files they care about and how to respond to changes:

```typescript
interface Filer_Observer {
	id: string; // Unique identifier

	// Matching strategies (at least one required)
	patterns?: Array<RegExp>; // Match file paths by regex
	paths?: Array<Path_Id> | (() => Array<Path_Id>); // Specific paths (can be dynamic)
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
	needs_imports?: boolean; // Parse imports for dependency tracking (default: false)

	// Execution control
	phase?: 'pre' | 'main' | 'post'; // When to run (default: 'main')
	priority?: number; // Higher runs first within phase (default: 0)
	timeout_ms?: number; // Max execution time (default: 30000)
	on_error?: (error: Error, batch: Filer_Change_Batch) => 'continue' | 'abort';

	// Handler
	on_change: (
		batch: Filer_Change_Batch,
	) => void | Array<Invalidation_Intent> | Promise<void | Array<Invalidation_Intent>>;
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

### Invalidation_Intent

Observers can return intents to trigger additional invalidations:

```typescript
interface Invalidation_Intent {
	type: 'all' | 'paths' | 'pattern' | 'dependents' | 'dependencies' | 'subtree';
	paths?: Array<Path_Id>; // For 'paths' type
	pattern?: RegExp; // For 'pattern' type
	disknode?: Disknode; // For 'dependents'/'dependencies'/'subtree' types
	include_self?: boolean; // For 'subtree' type
}
```

## design

### lazy synchronous loading

Disknode properties like `contents` and `stats` are loaded synchronously on first access.
This keeps the API simple without async contagion, and values are cached until invalidated.

```typescript
const disknode = filer.get_disknode('/path/to/file.ts');
console.log(disknode.contents); // Synchronously reads and caches file
console.log(disknode.stats); // Synchronously stats and caches
disknode.invalidate(); // Clear caches, next access will reload
```

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

### batch processing and change coalescing

Changes are batched to reduce processing overhead and properly coalesce rapid changes:

- **add + update → add** (preserve the add semantic)
- **add + delete → remove entirely** (file created and deleted in same batch)
- **delete + add → update** (file was recreated)

### execution phases

Observers execute in three phases to ensure proper ordering:

1. **pre** - Setup and generation tasks
2. **main** - Primary processing
3. **post** - Cleanup and finalization

Within each phase, observers run by priority (highest first).

### loop prevention

The system tracks processed disknodes globally across batch rounds to prevent infinite loops
when observers trigger additional invalidations.

### memory management

- File contents over 10MB bypass the cache
- External files (outside watched paths) are tracked but handled differently
- The complete filesystem mirror enables fast queries without filesystem access

## performance

- **initial scan**: O(n) where n = number of files
- **change detection**: O(1) per file via filesystem events
- **dependency lookup**: O(1) via Maps
- **tree traversal**: O(descendants) or O(ancestors)
- **memory usage**: ~1KB per file + cached contents

## limitations

- POSIX paths only (no Windows path support)
- Single-threaded import parsing
- No automatic memory management for very large trees
- No content hashing (relies on mtime for change detection)

## :turtle:<sub>:turtle:</sub><sub><sub>:turtle:</sub></sub>
