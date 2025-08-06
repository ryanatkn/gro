# Filer & Disknode Design Documentation

> @slop Claude Opus 4

## Overview

The Filer system provides a complete in-memory mirror of the filesystem for build tools, with automatic dependency tracking and efficient change propagation. It replaces ad-hoc file watching with a declarative, observable filesystem graph.

## Core Components

### Disknode

A lazy-loaded representation of a file or directory with automatic dependency tracking.

**Key Properties:**

- `id: Path_Id` - Absolute normalized path (POSIX only)
- `kind: 'file' | 'directory' | 'symlink'` - Node type
- `is_external: boolean` - Whether outside watched paths
- `exists: boolean` - False when deleted but still referenced

**Lazy Getters (synchronous, cached):**

- `stats` - File stats via lstat
- `contents` - File contents (null for directories, bypasses cache for >10MB files)
- `realpath` - Resolved path for symlinks
- `imports` - Parsed ES module imports (auto-updates dependencies)

**Relationships:**

- `parent` / `children` - Directory tree structure
- `dependencies` / `dependents` - Import graph

**Methods:**

- `invalidate()` - Increment version, clearing caches
- `add_dependency()` / `remove_dependency()` - Manage import relationships
- `get_ancestors()` / `get_descendants()` - Tree traversal

### Filer

The central filesystem orchestrator that maintains the Disknode graph and notifies observers of changes.

**Core Responsibilities:**

1. Maintain complete in-memory filesystem mirror
2. Batch filesystem events for atomic processing
3. Execute observers in phases with proper error isolation
4. Process invalidation intents for change propagation

**Key APIs:**

- `get_disknode(id)` - Get or create a Disknode
- `observe(observer)` - Register an observer, returns unsubscribe function
- `find_nodes(predicate)` - Query disknodes
- `get_dependents(node, recursive)` - Traverse dependency graph
- `filter_dependents(node, filter, recursive)` - Filter dependent disknodes

## Observer System

Observers declare what filesystem changes they care about and how to respond.

```typescript
interface Filer_Observer {
  id: string;

  // Matching (at least one required)
  patterns?: RegExp[];              // Match by regex
  paths?: Path_Id[] | (() => Path_Id[]);  // Match specific paths
  match?: (node: Disknode) => boolean;     // Custom logic

  // Filters
  track_external?: boolean;         // Include external files (default: false)
  track_directories?: boolean;      // Include directories (default: false)

  // Change propagation
  invalidate?: 'self' | 'dependents' | 'dependencies' | 'all';

  // Performance hints
  needs_contents?: boolean;         // Pre-load file contents
  needs_stats?: boolean;           // Pre-load stats (default: true)

  // Execution control
  phase?: 'pre' | 'main' | 'post'; // Execution phase
  priority?: number;                // Higher = earlier within phase
  timeout_ms?: number;              // Execution timeout
  on_error?: (err, batch) => 'continue' | 'abort';

  // Handler
  on_change: (batch: Filer_Change_Batch) => void | Invalidation_Intent[] | Promise<...>;
}
```

**Execution Flow:**

1. Filesystem events are batched (default 10ms delay)
2. Observers execute in phases: pre → main → post
3. Within each phase, observers run by priority (highest first)
4. Observers execute sequentially (no parallelism) to prevent races
5. Returned invalidation intents trigger additional changes

## Change Propagation

### Change Batch

Groups related filesystem changes into atomic units:

- `added` - Newly created disknodes
- `updated` - Modified disknodes
- `deleted` - Removed node IDs

### Invalidation Strategies

How changes propagate beyond directly matched files:

- `'self'` - Only the changed file
- `'dependents'` - Files that import this file
- `'dependencies'` - Files this file imports
- `'all'` - Every watched file

### Invalidation Intents

Observers can trigger broader invalidation:

```typescript
interface Invalidation_Intent {
	type: 'all' | 'paths' | 'pattern' | 'dependents' | 'dependencies' | 'subtree';
	paths?: Path_Id[]; // For 'paths'
	pattern?: RegExp; // For 'pattern'
	node?: Disknode; // For 'dependents'/'dependencies'/'subtree'
	include_self?: boolean; // For 'subtree'
}
```

## Key Design Decisions

### 1. Lazy Synchronous Loading

- **Why:** Clean API without async contagion
- **How:** Synchronous FS calls in getters with try/catch
- **Tradeoff:** Initial access may block, but cached thereafter

### 2. Version-based Cache Invalidation

- **Why:** Prevent stale reads during rapid changes
- **How:** Each node has a version counter that increments on change
- **Benefit:** Simple, correct cache invalidation

### 3. Automatic Dependency Tracking

- **Why:** Keep import graph always up-to-date
- **How:** Parse imports when `node.imports` is accessed
- **Benefit:** No separate dependency parsing step

### 4. Complete Filesystem Mirror

- **Why:** Enable fast queries without filesystem access
- **How:** Track all files and directories, even external ones
- **Tradeoff:** Higher memory usage for large trees

### 5. Declarative Observers

- **Why:** Separate "what to watch" from "how to react"
- **How:** Rich matching and filtering options
- **Benefit:** Reusable, testable, composable observers

## Usage Patterns

### Basic File Watching

```typescript
filer.observe({
	id: 'typescript-files',
	patterns: [/\.ts$/],
	on_change: async (batch) => {
		for (const node of batch.updated) {
			await compile(node);
		}
	},
});
```

### Dependency-Aware Watching

```typescript
filer.observe({
	id: 'test-runner',
	patterns: [/\.test\.ts$/],
	invalidate: 'dependencies', // Re-run when deps change
	on_change: async (batch) => {
		await runTests(batch.all_disknodes);
	},
});
```

### Multi-Phase Processing

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

// Then compile
filer.observe({
	id: 'compiler',
	patterns: [/\.ts$/],
	phase: 'main',
	on_change: async (batch) => {
		await compile(batch.all_disknodes);
	},
});
```

## Performance Characteristics

- **Initial Scan:** O(n) where n = number of files
- **Change Detection:** O(1) per file via Chokidar events
- **Dependency Lookup:** O(1) via Maps
- **Tree Traversal:** O(descendants) or O(ancestors)
- **Memory Usage:** ~1KB per file + cached contents

## Limitations & Future Work

**Current Limitations:**

- No content hashing (relies on mtime)
- Single-threaded dependency parsing
- No automatic memory management for large trees

**Potential Enhancements:**

- Worker thread support for parsing
- Incremental dependency updates
- Virtual file support
- .gitignore integration

**Intentional Omissions**

- No Windows path support (POSIX only)
- No glob pattern matching
