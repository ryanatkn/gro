import {existsSync, type Stats} from 'node:fs';
import {stat} from 'node:fs/promises';
import {watch, FSWatcher, type ChokidarOptions} from 'chokidar';
import {dirname, resolve, basename} from 'node:path';
import type {Logger} from '@ryanatkn/belt/log.js';
import {EMPTY_OBJECT} from '@ryanatkn/belt/object.js';

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
	/** Specific paths to watch (can be a function for dynamic paths) */
	paths?: Array<Path_Id> | (() => Array<Path_Id>);
	/** Custom matching function */
	match?: (node: Disknode) => boolean;

	// What changes to track
	/** Track external (non-watched) files. Default: false */
	track_external?: boolean;
	/** Track directory changes. Default: false */
	track_directories?: boolean;

	// Invalidation strategy
	/** How to propagate changes beyond matched files */
	invalidate?: 'self' | 'dependents' | 'dependencies' | 'all';

	// Performance hints
	/** Whether this observer needs file contents. Default: false */
	needs_contents?: boolean;
	/** Whether this observer needs file stats. Default: true */
	needs_stats?: boolean;

	// Execution order
	/** Execution phase. Default: 'main' */
	phase?: 'pre' | 'main' | 'post';
	/** Priority within phase (higher = earlier). Default: 0 */
	priority?: number;

	// Error handling
	/** How to handle errors. Default: 'abort' */
	on_error?: (error: Error, batch: Change_Batch) => 'continue' | 'abort';
	/** Timeout for observer execution. Default: 30000ms */
	timeout_ms?: number;

	/** Change handler - can be async and return invalidation intents */
	on_change: (
		changes: Change_Batch,
	) => void | Array<Invalidation_Intent> | Promise<void | Array<Invalidation_Intent>>;
}

/**
 * Represents a single filesystem change.
 */
export interface File_Change {
	type: 'add' | 'update' | 'delete';
	node?: Disknode; // Present for add/update
	id: Path_Id;
	kind: 'file' | 'directory' | 'symlink';
}

/**
 * Batch of filesystem changes delivered to observers.
 */
export class Change_Batch {
	readonly changes: Map<Path_Id, File_Change> = new Map();

	constructor(changes: Iterable<File_Change> = []) {
		for (const change of changes) {
			this.changes.set(change.id, change);
		}
	}

	/** Get all added nodes */
	get added(): Array<Disknode> {
		const nodes: Array<Disknode> = [];
		for (const change of this.changes.values()) {
			if (change.type === 'add' && change.node) {
				nodes.push(change.node);
			}
		}
		return nodes;
	}

	/** Get all updated nodes */
	get updated(): Array<Disknode> {
		const nodes: Array<Disknode> = [];
		for (const change of this.changes.values()) {
			if (change.type === 'update' && change.node) {
				nodes.push(change.node);
			}
		}
		return nodes;
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

	/** Get all nodes (added + updated) */
	get all_nodes(): Array<Disknode> {
		const nodes: Array<Disknode> = [];
		for (const change of this.changes.values()) {
			if (change.node) nodes.push(change.node);
		}
		return nodes;
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
	get(id: Path_Id): File_Change | undefined {
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

	/** All tracked nodes by absolute path */
	readonly nodes: Map<Path_Id, Disknode> = new Map();

	/** Root nodes (top-level watched paths) */
	readonly roots: Set<Disknode> = new Set();

	/** Watched paths for external checking */
	#watched_paths: Set<string>;

	/** Observers */
	#observers: Map<string, Filer_Observer> = new Map();
	#observers_by_phase: Map<'pre' | 'main' | 'post', Array<Filer_Observer>> = new Map();

	/** Batching */
	#pending_changes: Map<Path_Id, File_Change> = new Map();
	#batch_timeout: NodeJS.Timeout | undefined;
	#batch_delay: number;

	/** Configuration */
	#log?: Logger;
	#aliases: Array<[string, string]>;

	constructor(options: Filer_Options = EMPTY_OBJECT) {
		this.#batch_delay = options.batch_delay ?? 10;
		this.#log = options.log;
		this.#watched_paths = new Set();
		this.#aliases = options.aliases ?? [];

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
		if (options.paths || default_paths.length > 0) {
			void this.reset_watcher(options.paths ?? default_paths, options.chokidar_options);
		}

		// Add initial observers
		if (options.observers) {
			for (const observer of options.observers) {
				this.observe(observer);
			}
		}
	}

	/**
	 * Reset the file watcher with new paths.
	 * Clears all existing state and rebuilds from scratch.
	 */
	async reset_watcher(paths: Array<string>, chokidar_options?: ChokidarOptions): Promise<void> {
		await this.#watcher?.close();

		// Clear state
		this.nodes.clear();
		this.roots.clear();
		this.#pending_changes.clear();
		if (this.#batch_timeout) {
			clearTimeout(this.#batch_timeout);
			this.#batch_timeout = undefined;
		}

		// Store normalized watched paths
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

		// Wait for initial scan
		await new Promise<void>((resolve) => {
			this.#watcher!.once('ready', resolve);
		});
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
			node = this.get_node(id);
			node.kind = is_directory ? 'directory' : 'file';
			node.invalidate();

			// Pre-populate stats if provided to avoid extra syscall
			if (stats) {
				node.stats = stats;
			}
		} else {
			// For deletes, mark the node as non-existent
			node = this.nodes.get(id);
			if (node) {
				node.exists = false;
				node.invalidate();
			}
		}

		const change: File_Change = {
			type,
			node,
			id,
			kind: is_directory ? 'directory' : 'file',
		};

		this.#pending_changes.set(id, change);

		// Set up parent/child relationships for new nodes
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
				void this.#flush_batch();
			}, this.#batch_delay);
		}
	}

	/**
	 * Process all pending changes as an atomic batch.
	 */
	async #flush_batch(): Promise<void> {
		if (this.#pending_changes.size === 0) return;

		const batch = new Change_Batch(this.#pending_changes.values());
		this.#pending_changes.clear();

		await this.#process_batch(batch);
	}

	/**
	 * Get or create a node for the given path.
	 * Nodes are created lazily as they're referenced.
	 */
	get_node(id: Path_Id): Disknode {
		let node = this.nodes.get(id);
		if (!node) {
			node = new Disknode(id, this);
			this.nodes.set(id, node);

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
			// Not root
			const parent = this.get_node(parent_id);
			node.parent = parent;
			parent.children.set(basename(node.id), node);
			parent.kind = 'directory';
		} else {
			// This is a root
			this.roots.add(node);
		}
	}

	/**
	 * Check if a path is under watched directories.
	 */
	#is_watched_path(id: Path_Id): boolean {
		for (const watched of this.#watched_paths) {
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
	async #process_batch(batch: Change_Batch): Promise<void> {
		const phases: Array<'pre' | 'main' | 'post'> = ['pre', 'main', 'post'];
		const additional_intents: Array<Invalidation_Intent> = [];
		const processed_nodes: Set<Path_Id> = new Set(); // Prevent loops

		// Track all nodes in this batch as processed
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

				try {
					const result = await this.#execute_observer(observer, filtered); // eslint-disable-line no-await-in-loop
					if (result.length > 0) {
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
	#filter_batch_for_observer(batch: Change_Batch, observer: Filer_Observer): Change_Batch {
		const filtered: Map<Path_Id, File_Change> = new Map();

		// First, collect directly matching changes
		for (const [id, change] of batch.changes) {
			const node = change.node ?? this.nodes.get(id);
			if (!node) continue;

			// Check observer filters
			if (!observer.track_external && node.is_external) continue;
			if (!observer.track_directories && node.kind === 'directory') continue;

			// Check matching
			if (this.#observer_matches(observer, node)) {
				filtered.set(id, change);
			}
		}

		// Then, handle invalidation strategies
		if (observer.invalidate && observer.invalidate !== 'self') {
			const to_add: Map<Path_Id, File_Change> = new Map();

			for (const [id, change] of filtered) {
				const node = change.node ?? this.nodes.get(id);
				if (!node) continue;

				const invalidated = this.#get_invalidated_nodes(node, observer.invalidate);
				for (const inv_node of invalidated) {
					if (!filtered.has(inv_node.id) && !to_add.has(inv_node.id)) {
						// Skip external/directories based on observer config
						if (!observer.track_external && inv_node.is_external) continue;
						if (!observer.track_directories && inv_node.kind === 'directory') continue;

						to_add.set(inv_node.id, {
							type: 'update',
							node: inv_node,
							id: inv_node.id,
							kind: inv_node.kind,
						});
					}
				}
			}

			// Merge in the invalidated nodes
			for (const [id, change] of to_add) {
				filtered.set(id, change);
			}
		}

		return new Change_Batch(filtered.values());
	}

	/**
	 * Check if an observer matches a node.
	 */
	#observer_matches(observer: Filer_Observer, node: Disknode): boolean {
		if (observer.match?.(node)) return true;

		if (observer.patterns) {
			for (const pattern of observer.patterns) {
				if (pattern.test(node.id)) return true;
			}
		}

		if (observer.paths) {
			const paths = typeof observer.paths === 'function' ? observer.paths() : observer.paths;
			for (const path of paths) {
				if (node.id === resolve(path)) return true;
			}
		}

		return false;
	}

	/**
	 * Get nodes to invalidate based on strategy.
	 */
	#get_invalidated_nodes(node: Disknode, strategy: string): Set<Disknode> {
		const nodes: Set<Disknode> = new Set();

		switch (strategy) {
			case 'dependents':
				for (const dep of this.get_dependents(node, true)) {
					nodes.add(dep);
				}
				break;

			case 'dependencies':
				for (const dep of this.get_dependencies(node, true)) {
					nodes.add(dep);
				}
				break;

			case 'all':
				for (const n of this.nodes.values()) {
					if (!n.is_external) {
						nodes.add(n);
					}
				}
				break;
		}

		return nodes;
	}

	/**
	 * Execute an observer with timeout protection.
	 */
	async #execute_observer(
		observer: Filer_Observer,
		batch: Change_Batch,
	): Promise<Array<Invalidation_Intent>> {
		const timeout = observer.timeout_ms ?? 30000;

		const result = await Promise.race([
			Promise.resolve(observer.on_change(batch)),
			new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error(`Observer ${observer.id} timed out`)), timeout),
			),
		]);

		return Array.isArray(result) ? result : [];
	}

	/**
	 * Process invalidation intents from observers.
	 */
	async #process_invalidation_intents(
		intents: Array<Invalidation_Intent>,
		processed_nodes: Set<Path_Id>,
	): Promise<void> {
		const changes: Map<Path_Id, File_Change> = new Map();

		for (const intent of intents) {
			const nodes = this.#resolve_invalidation_intent(intent);

			for (const node of nodes) {
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
			await this.#process_batch(new Change_Batch(changes.values()));
		}
	}

	/**
	 * Resolve an invalidation intent to affected nodes.
	 */
	#resolve_invalidation_intent(intent: Invalidation_Intent): Set<Disknode> {
		const nodes: Set<Disknode> = new Set();

		switch (intent.type) {
			case 'all':
				for (const node of this.nodes.values()) {
					if (!node.is_external) nodes.add(node);
				}
				break;

			case 'paths':
				if (intent.paths) {
					for (const path of intent.paths) {
						const node = this.nodes.get(resolve(path));
						if (node && !node.is_external) nodes.add(node);
					}
				}
				break;

			case 'pattern':
				if (intent.pattern) {
					for (const node of this.nodes.values()) {
						if (!node.is_external && intent.pattern.test(node.id)) {
							nodes.add(node);
						}
					}
				}
				break;

			case 'dependents':
				if (intent.node) {
					for (const dep of this.get_dependents(intent.node, true)) {
						if (!dep.is_external) nodes.add(dep);
					}
				}
				break;

			case 'dependencies':
				if (intent.node) {
					for (const dep of this.get_dependencies(intent.node, true)) {
						if (!dep.is_external) nodes.add(dep);
					}
				}
				break;

			case 'subtree':
				if (intent.node) {
					if (intent.include_self && !intent.node.is_external) {
						nodes.add(intent.node);
					}
					for (const desc of intent.node.get_descendants()) {
						if (!desc.is_external) nodes.add(desc);
					}
				}
				break;
		}

		return nodes;
	}

	/**
	 * Find nodes matching a predicate.
	 */
	find_nodes(predicate: (node: Disknode) => boolean): Array<Disknode> {
		const results: Array<Disknode> = [];
		for (const node of this.nodes.values()) {
			if (predicate(node)) {
				results.push(node);
			}
		}
		return results;
	}

	/**
	 * Get all nodes that depend on the given node.
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
	 * Get all nodes that the given node depends on.
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
		return this.nodes.get(id);
	}

	/**
	 * Manually rescan a subtree for robustness.
	 * Useful after external changes or to recover from missed events.
	 */
	async rescan_subtree(path: string): Promise<void> {
		const id = resolve(path);
		const node = this.nodes.get(id);
		if (!node) return;

		// Invalidate entire subtree
		const intent: Invalidation_Intent = {
			type: 'subtree',
			node,
			include_self: true,
		};

		await this.#process_invalidation_intents([intent], new Set());
	}

	/**
	 * Load initial stats for all nodes in parallel.
	 * Useful for pre-warming the cache after initial scan.
	 */
	async load_initial_stats(): Promise<void> {
		const nodes = Array.from(this.nodes.values()).filter((n) => !n.is_external);
		const batch_size = 100;

		// Process in batches for parallelism without overwhelming the system
		for (let i = 0; i < nodes.length; i += batch_size) {
			const batch = nodes.slice(i, i + batch_size);
			// eslint-disable-next-line no-await-in-loop
			await Promise.all(
				batch.map(async (node) => {
					try {
						const stats = await stat(node.id);
						// Pre-populate stats to avoid later syscalls
						node.stats = stats;
					} catch {
						// Node doesn't exist, that's okay
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

		this.nodes.clear();
		this.roots.clear();
		this.#observers.clear();
		this.#observers_by_phase.clear();
	}
}
