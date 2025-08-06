import {existsSync, type Stats} from 'node:fs';
import {stat} from 'node:fs/promises';
import {watch, FSWatcher, type ChokidarOptions} from 'chokidar';
import {dirname, resolve, basename} from 'node:path';
import type {Logger} from '@ryanatkn/belt/log.js';
import {EMPTY_OBJECT} from '@ryanatkn/belt/object.js';
import {create_deferred, type Deferred} from '@ryanatkn/belt/async.js';

import {Disknode} from './disknode.ts';
import type {Path_Id} from './path.ts';
import {paths} from './paths.ts';
import {
	GRO_CONFIG_FILENAME,
	PACKAGE_JSON_FILENAME,
	SVELTE_CONFIG_FILENAME,
	TSCONFIG_FILENAME,
	VITE_CONFIG_FILENAME,
} from './constants.ts';

/**
 * Invalidation intent returned by observers to trigger additional changes.
 */
export interface Invalidation_Intent {
	type: 'all' | 'paths' | 'pattern' | 'dependents' | 'dependencies' | 'subtree';
	paths?: Array<Path_Id>; // For 'paths' type
	pattern?: RegExp; // For 'pattern' type
	node?: Disknode; // For 'dependents'/'dependencies'/'subtree' types
	include_self?: boolean; // For 'subtree' type
}

/**
 * Observer configuration for watching filesystem changes.
 */
export interface Filer_Observer {
	/** Unique identifier for this observer */
	id: string;

	// Matching strategies (at least one required)
	/** Regex patterns to match file paths */
	patterns?: Array<RegExp>;
	/** Specific paths to watch (can be a function for dynamic paths - should be
   pure and cheap) */
	paths?: Array<Path_Id> | (() => Array<Path_Id>);
	/** Custom matching function */
	match?: (node: Disknode) => boolean;

	// What changes to track
	/** Track external (non-watched) files. Default: false */
	track_external?: boolean;
	/** Track directory changes. Default: false */
	track_directories?: boolean;

	// Batch expansion strategy
	/** How to expand the batch beyond matched files. Default: 'self' */
	expand_to?: 'self' | 'dependents' | 'dependencies' | 'all';

	// Intent support
	/** Whether this observer can return invalidation intents. Default: false */
	returns_intents?: boolean;

	// Performance hints
	/** Whether this observer needs file contents. Default: false */
	needs_contents?: boolean;
	/** Whether this observer needs file stats. Default: true */
	needs_stats?: boolean;
	/** Whether this observer needs parsed imports for dependency tracking. 
  Default: false */
	needs_imports?: boolean;

	// Execution order
	/** Execution phase. Default: 'main' */
	phase?: 'pre' | 'main' | 'post';
	/** Priority within phase (higher = earlier). Default: 0 */
	priority?: number;

	// Error handling
	/** How to handle errors. Default: 'abort' */
	on_error?: (error: Error, batch: Filer_Change_Batch) => 'continue' | 'abort';
	/** Timeout for observer execution. Default: 30000ms */
	timeout_ms?: number;

	/** Change handler - can be async and return invalidation intents */
	on_change: (
		changes: Filer_Change_Batch,
	) => void | Array<Invalidation_Intent> | Promise<void | Array<Invalidation_Intent>>;
}

/**
 * Represents a single filesystem change.
 */
export interface Filer_Change {
	type: 'add' | 'update' | 'delete';
	node?: Disknode; // Present for add/update
	id: Path_Id;
	kind: 'file' | 'directory' | 'symlink';
}

/**
 * Batch of filesystem changes delivered to observers.
 */
export class Filer_Change_Batch {
	readonly changes: Map<Path_Id, Filer_Change> = new Map();

	constructor(changes: Iterable<Filer_Change> = []) {
		for (const change of changes) {
			this.changes.set(change.id, change);
		}
	}

	/** Get all added disknodes */
	get added(): Array<Disknode> {
		const disknodes: Array<Disknode> = [];
		for (const change of this.changes.values()) {
			if (change.type === 'add' && change.node) {
				disknodes.push(change.node);
			}
		}
		return disknodes;
	}

	/** Get all updated disknodes */
	get updated(): Array<Disknode> {
		const disknodes: Array<Disknode> = [];
		for (const change of this.changes.values()) {
			if (change.type === 'update' && change.node) {
				disknodes.push(change.node);
			}
		}
		return disknodes;
	}

	/** Get all deleted node IDs */
	get deleted(): Array<Path_Id> {
		const ids: Array<Path_Id> = [];
		for (const change of this.changes.values()) {
			if (change.type === 'delete') {
				ids.push(change.id);
			}
		}
		return ids;
	}

	/** Get all disknodes (added + updated) */
	get all_nodes(): Array<Disknode> {
		const disknodes: Array<Disknode> = [];
		for (const change of this.changes.values()) {
			if (change.node) disknodes.push(change.node);
		}
		return disknodes;
	}

	/** Total number of changes */
	get size(): number {
		return this.changes.size;
	}

	/** Check if batch contains a specific path */
	has(id: Path_Id): boolean {
		return this.changes.has(id);
	}

	/** Get change for a specific path */
	get(id: Path_Id): Filer_Change | undefined {
		return this.changes.get(id);
	}

	/** Check if batch is empty */
	get is_empty(): boolean {
		return this.changes.size === 0;
	}
}

/**
 * Options for creating a Filer instance.
 */
export interface Filer_Options {
	/** Paths to watch. Default: [paths.source, config files] */
	paths?: Array<string>;
	/** Chokidar watcher options */
	chokidar_options?: ChokidarOptions;
	/** Delay for batching changes in ms. Default: 10 */
	batch_delay?: number;
	/** Initial observers to register */
	observers?: Array<Filer_Observer>;
	/** Logger instance */
	log?: Logger;
	/** Alias mappings for import resolution */
	aliases?: Array<[string, string]>;
}

/**
 * Complete in-memory filesystem mirror with dependency tracking.
 * Provides efficient file watching, querying, and change propagation.
 */
export class Filer {
	#watcher: FSWatcher | undefined;

	/** All tracked disknodes by absolute path */
	readonly disknodes: Map<Path_Id, Disknode> = new Map();

	/** Root disknodes (top-level watched paths) */
	readonly roots: Set<Disknode> = new Set();

	/** Watched paths for external checking */
	#watched_paths: Set<string>;

	/** Observers */
	#observers: Map<string, Filer_Observer> = new Map();
	#observers_by_phase: Map<'pre' | 'main' | 'post', Array<Filer_Observer>> = new Map();

	/** Batching */
	#pending_changes: Map<Path_Id, Filer_Change> = new Map();
	#batch_timeout: NodeJS.Timeout | undefined;
	#batch_delay: number;

	/** Configuration */
	#log?: Logger;
	#aliases: Array<[string, string]>;

	/** Shared processed disknodes for loop prevention across batch rounds */
	#processed_nodes_global: Set<Path_Id> | undefined;

	/** Promise that resolves when the filer is ready (watcher initialized) */
	#ready_deferred: Deferred<void>;
	get ready(): Promise<void> {
		return this.#ready_deferred.promise;
	}

	constructor(options: Filer_Options = EMPTY_OBJECT) {
		this.#batch_delay = options.batch_delay ?? 10;
		this.#log = options.log;
		this.#watched_paths = new Set();
		this.#aliases = options.aliases ?? [];
		this.#ready_deferred = create_deferred<void>();

		// Add initial observers first
		if (options.observers) {
			for (const observer of options.observers) {
				this.observe(observer);
			}
		}

		// Default paths include source and config files
		const default_paths = [
			paths.source,
			'./' + PACKAGE_JSON_FILENAME,
			'./' + TSCONFIG_FILENAME,
			'./' + SVELTE_CONFIG_FILENAME,
			'./' + VITE_CONFIG_FILENAME,
			'./' + GRO_CONFIG_FILENAME,
		].filter(existsSync);

		// Initialize with provided paths
		const paths_to_watch = options.paths ?? default_paths;
		if (paths_to_watch.length > 0) {
			// Start the watcher setup - ready promise will resolve when complete
			this.reset_watcher(paths_to_watch, options.chokidar_options).catch((err) => {
				this.#log?.error('[Filer] Failed to initialize watcher', err);
				// Resolve ready to prevent hanging - the error was already handled in reset_watcher
			});
		} else {
			// No paths to watch, immediately ready
			this.#ready_deferred.resolve();
		}
	}

	/**
	 * Reset the file watcher with new paths.
	 * Clears all existing state and rebuilds from scratch.
	 * If called multiple times concurrently, later calls will take over.
	 */
	async reset_watcher(paths: Array<string>, chokidar_options?: ChokidarOptions): Promise<void> {
		// Create a new deferred for this reset operation
		const new_ready = create_deferred<void>();
		this.#ready_deferred = new_ready;

		try {
			// Close existing watcher if any
			await this.#watcher?.close();

			// Clear state
			this.disknodes.clear();
			this.roots.clear();
			this.#pending_changes.clear();
			if (this.#batch_timeout) {
				clearTimeout(this.#batch_timeout);
				this.#batch_timeout = undefined;
			}

			// Store normalized watched paths (don't create disknodes yet)
			this.#watched_paths = new Set(paths.map((p) => resolve(p)));

			// Create watcher with sensible defaults
			this.#watcher = watch(paths, {
				persistent: true,
				ignoreInitial: false,
				followSymlinks: true, // Chokidar handles symlinks
				awaitWriteFinish: {
					stabilityThreshold: 50,
					pollInterval: 10,
				},
				...chokidar_options,
			});

			this.#setup_watcher_handlers();

			// Wait for initial scan with timeout protection
			await new Promise<void>((resolve) => {
				// If we've been superseded, just resolve immediately
				if (this.#ready_deferred !== new_ready) {
					resolve();
					return;
				}

				// Set up timeout in case watcher never becomes ready
				const timeout = setTimeout(() => {
					this.#log?.warn('[Filer] Watcher ready timeout after 10s');
					resolve();
				}, 10000);

				this.#watcher!.once('ready', () => {
					clearTimeout(timeout);
					resolve();
				});
			});

			// Only mark as ready if we're still the current reset
			if (this.#ready_deferred === new_ready) {
				new_ready.resolve();
			}
		} catch (err) {
			// On error, resolve (not reject) to prevent hanging
			// but log the error so it's not silently swallowed
			this.#log?.error('[Filer] reset_watcher failed', err);
			if (this.#ready_deferred === new_ready) {
				new_ready.resolve(); // Resolve, not reject, to allow continued operation
			}
		}
	}

	/**
	 * Set up filesystem event handlers.
	 */
	#setup_watcher_handlers(): void {
		if (!this.#watcher) return;

		this.#watcher.on('add', (path, stats) => {
			this.#handle_change('add', path, false, stats);
		});

		this.#watcher.on('addDir', (path, stats) => {
			this.#handle_change('add', path, true, stats);
		});

		this.#watcher.on('change', (path, stats) => {
			this.#handle_change('update', path, false, stats);
		});

		this.#watcher.on('unlink', (path) => {
			this.#handle_change('delete', path, false);
		});

		this.#watcher.on('unlinkDir', (path) => {
			this.#handle_change('delete', path, true);
		});
	}

	/**
	 * Coalesce change events properly to preserve semantic intent.
	 */
	#coalesce_change(prev: Filer_Change | undefined, next: Filer_Change): Filer_Change | undefined {
		if (!prev) return next;

		// add + change → add (preserve the add semantic)
		if (prev.type === 'add' && next.type === 'update') return prev;

		// add + delete → remove entry entirely (file was created and deleted in same batch)
		if (prev.type === 'add' && next.type === 'delete') return undefined;

		// delete + add → update (file was deleted then recreated)
		if (prev.type === 'delete' && next.type === 'add') {
			return {...next, type: 'update'};
		}

		// Everything else, latest wins
		return next;
	}

	/**
	 * Handle a filesystem change event.
	 * Batches changes for efficient processing.
	 */
	#handle_change(
		type: 'add' | 'update' | 'delete',
		path: string,
		is_directory: boolean,
		stats?: Stats,
	): void {
		const id = resolve(path);

		let node: Disknode | undefined;
		if (type !== 'delete') {
			node = this.get_disknode(id);
			node.kind = is_directory ? 'directory' : 'file';
			node.invalidate();

			// Add to roots if this is a watched path
			if (this.#watched_paths.has(id)) {
				this.roots.add(node);
			}

			// Pre-populate stats if provided to avoid extra syscall
			if (stats && node.stats_version !== node.version) {
				node.stats = stats;
			}
		} else {
			// For deletes, mark the node as non-existent
			node = this.disknodes.get(id);
			if (node) {
				node.exists = false;
				node.invalidate();
				// Clean up relationships - remove this node from other disknodes' maps
				for (const [, dep] of node.dependencies) {
					dep.dependents.delete(id);
				}
				for (const [, dep] of node.dependents) {
					dep.dependencies.delete(id);
				}
				// Clear this node's maps
				node.dependencies.clear();
				node.dependents.clear();
			}
		}

		const change: Filer_Change = {
			type,
			node,
			id,
			kind: is_directory ? 'directory' : 'file',
		};

		// Apply coalescing rules
		const existing = this.#pending_changes.get(id);
		const coalesced = this.#coalesce_change(existing, change);

		if (coalesced) {
			this.#pending_changes.set(id, coalesced);
		} else {
			// Remove entry entirely (e.g., add+delete)
			this.#pending_changes.delete(id);
		}

		// Set up parent/child relationships for new disknodes
		if (type === 'add' && node) {
			this.#setup_node_relationships(node);
		}

		// Remove from parent on delete
		if (type === 'delete' && node?.parent) {
			node.parent.children.delete(basename(id));
		}

		// Schedule batch processing
		if (!this.#batch_timeout) {
			this.#batch_timeout = setTimeout(() => {
				this.#batch_timeout = undefined;
				this.#flush_batch().catch((err) => {
					this.#log?.error('[Filer] flush_batch failed', err);
				});
			}, this.#batch_delay);
		}
	}

	/**
	 * Process all pending changes as an atomic batch.
	 */
	async #flush_batch(): Promise<void> {
		if (this.#pending_changes.size === 0) return;

		// Take a snapshot of pending changes before clearing
		const batch = new Filer_Change_Batch(this.#pending_changes.values());
		this.#pending_changes.clear();

		// Start a new global processed disknodes set if not in a nested call
		const is_root_flush = !this.#processed_nodes_global;
		if (is_root_flush) {
			this.#processed_nodes_global = new Set();
		}

		try {
			await this.#process_batch(batch, this.#processed_nodes_global!);
		} finally {
			if (is_root_flush) {
				this.#processed_nodes_global = undefined;
			}
		}
	}

	/**
	 * Get or create a node for the given path.
	 * Nodes are created lazily as they're referenced.
	 */
	get_disknode(id: Path_Id): Disknode {
		let node = this.disknodes.get(id);
		if (!node) {
			node = new Disknode(id, this);
			this.disknodes.set(id, node);

			// Check if external
			node.is_external = !this.#is_watched_path(id);

			// Set up relationships
			this.#setup_node_relationships(node);
		}
		return node;
	}

	/**
	 * Set up parent/child relationships for a node.
	 */
	#setup_node_relationships(node: Disknode): void {
		const parent_id = dirname(node.id);
		if (parent_id !== node.id) {
			// Not filesystem root
			const parent = this.get_disknode(parent_id);
			node.parent = parent;
			parent.children.set(basename(node.id), node);
			parent.kind = 'directory';
		}
		// Note: roots are tracked separately when watched paths are set
	}

	/**
	 * Check if a path is under watched directories.
	 */
	#is_watched_path(id: Path_Id): boolean {
		// If no watched paths are set, consider everything as watched (internal)
		if (this.#watched_paths.size === 0) {
			return true;
		}

		for (const watched of this.#watched_paths) {
			// Special case for root
			if (watched === '/') {
				return true;
			}
			if (id === watched || id.startsWith(watched + '/')) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Map import specifier through aliases.
	 */
	map_alias(specifier: string): string {
		for (const [from, to] of this.#aliases) {
			if (specifier === from || specifier.startsWith(from + '/')) {
				return to + specifier.slice(from.length);
			}
		}
		return specifier;
	}

	/**
	 * Register an observer for filesystem changes.
	 * Returns an unsubscribe function.
	 */
	observe(observer: Filer_Observer): () => void {
		this.#observers.set(observer.id, observer);
		this.#organize_observers_by_phase();

		// Return unsubscribe function
		return () => {
			this.#observers.delete(observer.id);
			this.#organize_observers_by_phase();
		};
	}

	/**
	 * Organize observers by execution phase and priority.
	 */
	#organize_observers_by_phase(): void {
		this.#observers_by_phase.clear();

		for (const observer of this.#observers.values()) {
			const phase = observer.phase ?? 'main';
			const observers = this.#observers_by_phase.get(phase) ?? [];
			observers.push(observer);
			this.#observers_by_phase.set(phase, observers);
		}

		// Sort by priority within each phase
		for (const observers of this.#observers_by_phase.values()) {
			observers.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
		}
	}

	/**
	 * Process a batch of changes through all observers.
	 */
	async #process_batch(batch: Filer_Change_Batch, processed_nodes: Set<Path_Id>): Promise<void> {
		const phases: Array<'pre' | 'main' | 'post'> = ['pre', 'main', 'post'];
		const additional_intents: Array<Invalidation_Intent> = [];

		// Track all disknodes in this batch as processed
		for (const change of batch.changes.values()) {
			processed_nodes.add(change.id);
		}

		// Execute observers in phases
		for (const phase of phases) {
			const observers = this.#observers_by_phase.get(phase) ?? [];

			for (const observer of observers) {
				const filtered = this.#filter_batch_for_observer(batch, observer);
				if (filtered.is_empty) continue;

				// Pre-warm data if needed
				if (observer.needs_contents) {
					for (const node of filtered.all_nodes) {
						node.contents; // Trigger lazy load
					}
				}

				if (observer.needs_stats !== false) {
					for (const node of filtered.all_nodes) {
						node.stats; // Trigger lazy load
					}
				}

				// Pre-parse imports if needed for dependency tracking
				if (
					observer.needs_imports ||
					observer.expand_to === 'dependents' ||
					observer.expand_to === 'dependencies'
				) {
					for (const node of filtered.all_nodes) {
						if (node.is_importable) {
							node.imports; // Trigger import parsing and dependency updates
						}
					}
				}

				try {
					const result = await this.#execute_observer(observer, filtered); // eslint-disable-line no-await-in-loop
					if (observer.returns_intents && result.length > 0) {
						additional_intents.push(...result);
					}
				} catch (error) {
					const action = observer.on_error?.(error as Error, filtered) ?? 'abort';
					if (action === 'abort') {
						throw error;
					}
					this.#log?.error(`Observer ${observer.id} failed:`, error);
				}
			}
		}

		// Process invalidation intents
		if (additional_intents.length > 0) {
			await this.#process_invalidation_intents(additional_intents, processed_nodes);
		}
	}

	/**
	 * Filter batch changes based on observer configuration.
	 */
	#filter_batch_for_observer(
		batch: Filer_Change_Batch,
		observer: Filer_Observer,
	): Filer_Change_Batch {
		const filtered: Map<Path_Id, Filer_Change> = new Map();

		// Cache dynamic paths evaluation
		const dynamic_paths =
			observer.paths && typeof observer.paths === 'function' ? observer.paths() : observer.paths;

		// First, collect directly matching changes
		for (const [id, change] of batch.changes) {
			const node = change.node ?? this.disknodes.get(id);
			if (!node) continue;

			// Check observer filters
			if (!observer.track_external && node.is_external) continue;
			if (!observer.track_directories && node.kind === 'directory') continue;

			// Check matching
			if (this.#observer_matches(observer, node, dynamic_paths)) {
				filtered.set(id, change);
			}
		}

		// Then, handle batch expansion strategies
		const expand_to = observer.expand_to ?? 'self';
		if (expand_to !== 'self') {
			const to_add: Map<Path_Id, Filer_Change> = new Map();

			for (const [id, change] of filtered) {
				const node = change.node ?? this.disknodes.get(id);
				if (!node) continue;

				const expanded = this.#get_expanded_nodes(node, expand_to);
				for (const exp_node of expanded) {
					if (!filtered.has(exp_node.id) && !to_add.has(exp_node.id)) {
						// Skip external/directories based on observer config
						if (!observer.track_external && exp_node.is_external) continue;
						if (!observer.track_directories && exp_node.kind === 'directory') continue;

						to_add.set(exp_node.id, {
							type: 'update',
							node: exp_node,
							id: exp_node.id,
							kind: exp_node.kind,
						});
					}
				}
			}

			// Merge in the expanded disknodes
			for (const [id, change] of to_add) {
				filtered.set(id, change);
			}
		}

		return new Filer_Change_Batch(filtered.values());
	}

	/**
	 * Check if an observer matches a node.
	 */
	#observer_matches(
		observer: Filer_Observer,
		node: Disknode,
		cached_paths?: Array<Path_Id>,
	): boolean {
		if (observer.match?.(node)) return true;

		if (observer.patterns) {
			for (const pattern of observer.patterns) {
				// Reset lastIndex for stateful regexes
				if (pattern.global || pattern.sticky) {
					pattern.lastIndex = 0;
				}
				if (pattern.test(node.id)) return true;
			}
		}

		if (cached_paths) {
			for (const path of cached_paths) {
				if (node.id === resolve(path)) return true;
			}
		}

		return false;
	}

	/**
	 * Get disknodes to expand to based on strategy.
	 */
	#get_expanded_nodes(node: Disknode, strategy: string): Set<Disknode> {
		const disknodes: Set<Disknode> = new Set();

		switch (strategy) {
			case 'dependents':
				for (const dep of this.get_dependents(node, true)) {
					disknodes.add(dep);
				}
				break;

			case 'dependencies':
				for (const dep of this.get_dependencies(node, true)) {
					disknodes.add(dep);
				}
				break;

			case 'all':
				for (const n of this.disknodes.values()) {
					if (!n.is_external) {
						disknodes.add(n);
					}
				}
				break;
		}

		return disknodes;
	}

	/**
	 * Execute an observer with timeout protection.
	 */
	async #execute_observer(
		observer: Filer_Observer,
		batch: Filer_Change_Batch,
	): Promise<Array<Invalidation_Intent>> {
		const timeout = observer.timeout_ms ?? 30000;
		let timer: NodeJS.Timeout | undefined;

		try {
			const result = await Promise.race([
				Promise.resolve(observer.on_change(batch)),
				new Promise<never>((_, reject) => {
					timer = setTimeout(() => reject(new Error(`Observer ${observer.id} timed out`)), timeout);
				}),
			]);

			return Array.isArray(result) ? result : [];
		} finally {
			if (timer) clearTimeout(timer);
		}
	}

	/**
	 * Process invalidation intents from observers.
	 */
	async #process_invalidation_intents(
		intents: Array<Invalidation_Intent>,
		processed_nodes: Set<Path_Id>,
	): Promise<void> {
		const changes: Map<Path_Id, Filer_Change> = new Map();

		for (const intent of intents) {
			const disknodes = this.#resolve_invalidation_intent(intent);

			for (const node of disknodes) {
				// Skip already processed to prevent loops
				if (processed_nodes.has(node.id)) continue;
				if (node.is_external) continue;

				processed_nodes.add(node.id);
				node.invalidate();

				changes.set(node.id, {
					type: 'update',
					node,
					id: node.id,
					kind: node.kind,
				});
			}
		}

		if (changes.size > 0) {
			await this.#process_batch(new Filer_Change_Batch(changes.values()), processed_nodes);
		}
	}

	/**
	 * Resolve an invalidation intent to affected disknodes.
	 */
	#resolve_invalidation_intent(intent: Invalidation_Intent): Set<Disknode> {
		const disknodes: Set<Disknode> = new Set();

		switch (intent.type) {
			case 'all':
				for (const node of this.disknodes.values()) {
					if (!node.is_external) disknodes.add(node);
				}
				break;

			case 'paths':
				if (intent.paths) {
					for (const path of intent.paths) {
						// Use get_disknode to create if needed (allows targeting not-yet-seen files)
						const node = this.get_disknode(resolve(path));
						if (!node.is_external) disknodes.add(node);
					}
				}
				break;

			case 'pattern':
				if (intent.pattern) {
					// Reset lastIndex for stateful regexes
					if (intent.pattern.global || intent.pattern.sticky) {
						intent.pattern.lastIndex = 0;
					}
					for (const node of this.disknodes.values()) {
						if (!node.is_external) {
							// Reset again before each test
							if (intent.pattern.global || intent.pattern.sticky) {
								intent.pattern.lastIndex = 0;
							}
							if (intent.pattern.test(node.id)) {
								disknodes.add(node);
							}
						}
					}
				}
				break;

			case 'dependents':
				if (intent.node) {
					for (const dep of this.get_dependents(intent.node, true)) {
						if (!dep.is_external) disknodes.add(dep);
					}
				}
				break;

			case 'dependencies':
				if (intent.node) {
					for (const dep of this.get_dependencies(intent.node, true)) {
						if (!dep.is_external) disknodes.add(dep);
					}
				}
				break;

			case 'subtree':
				if (intent.node) {
					if (intent.include_self && !intent.node.is_external) {
						disknodes.add(intent.node);
					}
					for (const desc of intent.node.get_descendants()) {
						if (!desc.is_external) disknodes.add(desc);
					}
				}
				break;
		}

		return disknodes;
	}

	/**
	 * Find disknodes matching a predicate.
	 */
	find_nodes(predicate: (node: Disknode) => boolean): Array<Disknode> {
		const results: Array<Disknode> = [];
		for (const node of this.disknodes.values()) {
			if (predicate(node)) {
				results.push(node);
			}
		}
		return results;
	}

	/**
	 * Get all disknodes that depend on the given node.
	 * @param recursive - Whether to include transitive dependents
	 */
	get_dependents(node: Disknode, recursive = true): Set<Disknode> {
		const visited: Set<Disknode> = new Set();
		const stack = [node];

		while (stack.length > 0) {
			const current = stack.pop()!;
			if (visited.has(current)) continue;
			visited.add(current);

			for (const dependent of current.dependents.values()) {
				if (!visited.has(dependent)) {
					if (recursive) {
						stack.push(dependent);
					} else {
						visited.add(dependent);
					}
				}
			}
		}

		visited.delete(node); // Don't include self
		return visited;
	}

	/**
	 * Get all disknodes that the given node depends on.
	 * @param recursive - Whether to include transitive dependencies
	 */
	get_dependencies(node: Disknode, recursive = true): Set<Disknode> {
		const visited: Set<Disknode> = new Set();
		const stack = [node];

		while (stack.length > 0) {
			const current = stack.pop()!;
			if (visited.has(current)) continue;
			visited.add(current);

			for (const dependency of current.dependencies.values()) {
				if (!visited.has(dependency)) {
					if (recursive) {
						stack.push(dependency);
					} else {
						visited.add(dependency);
					}
				}
			}
		}

		visited.delete(node); // Don't include self
		return visited;
	}

	/**
	 * Filter and get dependents matching a predicate.
	 * Equivalent to the original filter_dependents function.
	 */
	filter_dependents(
		node: Disknode,
		filter?: (id: Path_Id) => boolean,
		recursive = true,
	): Set<Path_Id> {
		const results: Set<Path_Id> = new Set();
		const visited: Set<Path_Id> = new Set();
		const stack = [node];

		while (stack.length > 0) {
			const current = stack.pop()!;
			if (visited.has(current.id)) continue;
			visited.add(current.id);

			for (const dependent of current.dependents.values()) {
				if (!visited.has(dependent.id)) {
					if (!filter || filter(dependent.id)) {
						results.add(dependent.id);
					}
					if (recursive) {
						stack.push(dependent);
					}
				}
			}
		}

		return results;
	}

	/**
	 * Get node by ID.
	 */
	get_by_id(id: Path_Id): Disknode | undefined {
		return this.disknodes.get(id);
	}

	/**
	 * Manually rescan a subtree for robustness.
	 * Useful after external changes or to recover from missed events.
	 */
	async rescan_subtree(path: string): Promise<void> {
		const id = resolve(path);
		const node = this.disknodes.get(id);
		if (!node) return;

		// Invalidate entire subtree
		const intent: Invalidation_Intent = {
			type: 'subtree',
			node,
			include_self: true,
		};

		const processed_nodes: Set<Path_Id> = new Set();
		await this.#process_invalidation_intents([intent], processed_nodes);
	}

	/**
	 * Load initial stats for all disknodes in parallel.
	 * Useful for pre-warming the cache after initial scan.
	 */
	async load_initial_stats(): Promise<void> {
		// When no paths are watched, treat all disknodes as internal for stat loading
		const has_watched_paths = this.#watched_paths.size > 0;
		const disknodes = Array.from(this.disknodes.values()).filter(
			(n) => !has_watched_paths || !n.is_external,
		);
		const batch_size = 100;

		// Process in batches for parallelism without overwhelming the system
		for (let i = 0; i < disknodes.length; i += batch_size) {
			const batch = disknodes.slice(i, i + batch_size);
			// eslint-disable-next-line no-await-in-loop
			await Promise.all(
				batch.map(async (node) => {
					try {
						const file_stats = await stat(node.id);
						// Force set stats, bypassing version check
						node.set_stats_force(file_stats);
					} catch {
						// Node doesn't exist, that's okay
						// TODO but what about other errors like permission issues?
					}
				}),
			);
		}
	}

	/**
	 * Clean up and close the filer.
	 */
	async close(): Promise<void> {
		if (this.#batch_timeout) {
			clearTimeout(this.#batch_timeout);
			this.#batch_timeout = undefined;
		}

		await this.#watcher?.close();
		this.#watcher = undefined;

		this.disknodes.clear();
		this.roots.clear();
		this.#observers.clear();
		this.#observers_by_phase.clear();
	}
}
