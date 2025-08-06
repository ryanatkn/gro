// @slop Claude Opus 4.1

import {existsSync, type Stats} from 'node:fs';
import {stat} from 'node:fs/promises';
import {watch, FSWatcher, type ChokidarOptions} from 'chokidar';
import {dirname, resolve, basename} from 'node:path';
import type {Logger} from '@ryanatkn/belt/log.js';
import {EMPTY_OBJECT} from '@ryanatkn/belt/object.js';
import {escape_regexp} from '@ryanatkn/belt/regexp.js';

import {Disknode} from './disknode.ts';
import type {Path_Id} from './path.ts';
import {DEFAULT_CONFIG_FILES, SOURCE_DIRNAME} from './constants.ts';
import {
	Filer_Phase_Order,
	Filer_Change_Batch,
	filer_coalesce_change,
	filer_should_filter_disknode,
	filer_observer_matches,
	filer_observer_needs_imports,
	filer_execute_observer,
	Filer_Phase,
	filer_traverse_relationships,
	filer_resolve_intent_disknodes,
	type Filer_Change,
	type Filer_Observer,
	type Filer_Expand_Strategy,
	type Filer_Invalidation_Intent,
} from './filer_helpers.ts';

/**
 * Options for creating a Filer instance.
 */
export interface Filer_Options {
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

	/** Tombstone cache for deleted disknodes with FIFO eviction */
	readonly tombstones: Map<Path_Id, Disknode> = new Map();

	/** Maximum number of tombstones to keep (default: 500) */
	tombstone_limit = 500;

	/** Root disknodes (top-level watched paths) */
	readonly roots: Set<Disknode> = new Set();

	/** Watched paths for external checking */
	#watched_paths: Set<string>;

	/** Observers */
	#observers: Map<string, Filer_Observer> = new Map();
	#observers_sorted: Array<Filer_Observer> = [];
	#observers_dirty = true;

	/** Batching */
	#pending_changes: Map<Path_Id, Filer_Change> = new Map();
	#batch_timeout: NodeJS.Timeout | undefined;
	#batch_delay: number;

	/** Pending dependency updates */
	#pending_dependency_updates: Set<Disknode> = new Set();

	/** Configuration */
	#log?: Logger;
	#alias_matchers: Array<{re: RegExp; from: string; to: string}>;

	/** Whether the filer has been mounted */
	#mounted = false;

	/** Whether the filer has been disposed */
	#disposed = false;

	constructor(options: Filer_Options = EMPTY_OBJECT) {
		this.#batch_delay = options.batch_delay ?? 10;
		this.#log = options.log;
		this.#watched_paths = new Set();

		// Build precompiled alias matchers
		const aliases = options.aliases ?? [];
		this.#alias_matchers = aliases.map(([from, to]) => ({
			re: new RegExp(`^${escape_regexp(from)}(?:/|$)`),
			from,
			to,
		}));

		// Add initial observers
		if (options.observers) {
			for (const observer of options.observers) {
				this.observe(observer);
			}
		}
	}

	/**
	 * Mount the filer to start watching the filesystem.
	 * Must be called before using the filer.
	 */
	async mount(paths?: Array<string>, chokidar_options?: ChokidarOptions): Promise<void> {
		// Check preconditions
		if (this.#mounted) throw new Error('Filer already mounted');
		if (this.#disposed) throw new Error('Cannot mount disposed filer');

		// Mark as mounted immediately to prevent race conditions
		this.#mounted = true;

		try {
			// Default paths include source and config files
			const default_paths = [resolve(SOURCE_DIRNAME), ...DEFAULT_CONFIG_FILES].filter(existsSync);
			const final_paths = paths ?? default_paths;

			// Set up watcher if needed
			if (final_paths.length > 0) {
				await this.#setup_watcher(final_paths, chokidar_options);
			}
		} catch (err) {
			// Reset mounted state on failure
			this.#mounted = false;
			throw err;
		}
	}

	/**
	 * Reset the file watcher with new paths.
	 * Clears all existing state and rebuilds from scratch.
	 */
	async reset_watcher(paths: Array<string>, chokidar_options?: ChokidarOptions): Promise<void> {
		this.#check_mounted();

		// Clear existing state and rebuild
		await this.#clear_state();
		await this.#setup_watcher(paths, chokidar_options);
	}

	/**
	 * Set up the watcher with given paths.
	 */
	async #setup_watcher(paths: Array<string>, chokidar_options?: ChokidarOptions): Promise<void> {
		await this.#watcher?.close();
		this.#watched_paths = new Set(paths.map((p) => resolve(p)));

		this.#watcher = watch(paths, {
			persistent: true,
			ignoreInitial: false,
			followSymlinks: true,
			awaitWriteFinish: {stabilityThreshold: 50, pollInterval: 10},
			...chokidar_options,
		});

		this.#setup_watcher_handlers();

		// Wait for initial scan with timeout
		await new Promise<void>((resolve, reject) => {
			const timeout = setTimeout(() => reject(new Error('Watcher timeout after 10s')), 10000);
			this.#watcher!.once('ready', () => {
				clearTimeout(timeout);
				resolve();
			});
		});
	}

	/**
	 * Clear all state.
	 */
	async #clear_state(): Promise<void> {
		await this.#watcher?.close();
		this.disknodes.clear();
		this.tombstones.clear();
		this.roots.clear();
		this.#pending_changes.clear();
		this.#pending_dependency_updates.clear();
		if (this.#batch_timeout) {
			clearTimeout(this.#batch_timeout);
			this.#batch_timeout = undefined;
		}
	}

	/**
	 * Check that the filer is mounted.
	 */
	#check_mounted(): void {
		if (!this.#mounted) throw new Error('Filer not mounted - call mount() first');
		if (this.#disposed) throw new Error('Filer disposed');
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

		let disknode: Disknode | undefined;
		if (type !== 'delete') {
			disknode = this.get_disknode(id);
			disknode.kind = is_directory ? 'directory' : 'file';
			disknode.invalidate();

			// Add to roots if this is a watched path
			if (this.#watched_paths.has(id)) {
				this.roots.add(disknode);
			}

			// Pre-populate stats if provided to avoid extra syscall
			if (stats) {
				disknode.set_stats(stats);
			}

			// Queue for dependency update if it's importable
			if (disknode.is_importable) {
				this.#pending_dependency_updates.add(disknode);
			}
		} else {
			// For deletes, move to tombstones
			disknode = this.disknodes.get(id);
			if (disknode) {
				disknode.exists = false;
				disknode.invalidate();
				// Don't clear relationships yet - observers need them for expansion
				// They will be cleared after batch processing
				this.#add_to_tombstones(disknode);
			}
		}

		const change: Filer_Change = {
			type,
			disknode,
			id,
			kind: is_directory ? 'directory' : 'file',
		};

		// Apply coalescing rules
		const existing = this.#pending_changes.get(id);
		const coalesced = filer_coalesce_change(existing, change);

		if (coalesced) {
			this.#pending_changes.set(id, coalesced);
		} else {
			// Remove entry entirely (e.g., add+delete)
			this.#pending_changes.delete(id);
		}

		// Remove from parent on delete
		if (type === 'delete' && disknode?.parent) {
			disknode.parent.children.delete(basename(id));
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

		// Only process pending dependency updates if at least one observer needs them
		if (this.#any_observer_needs_imports()) {
			this.#process_pending_dependency_updates();
		} else {
			// Clear pending updates without processing
			this.#pending_dependency_updates.clear();
		}

		// Process with loop prevention
		const processed: Set<Path_Id> = new Set();
		await this.#process_batch_with_intents(batch, processed);

		// Clear relationships for deleted nodes after observers have processed them
		this.#clear_deleted_node_relationships(batch);
	}

	/**
	 * Clear relationships for deleted nodes after observers have processed the batch.
	 */
	#clear_deleted_node_relationships(batch: Filer_Change_Batch): void {
		for (const change of batch.changes.values()) {
			if (change.type === 'delete' && change.disknode && !change.disknode.exists) {
				change.disknode.clear_relationships();
			}
		}
	}

	/**
	 * Check if any observer needs imports for dependency tracking.
	 */
	#any_observer_needs_imports(): boolean {
		for (const observer of this.#observers.values()) {
			if (filer_observer_needs_imports(observer)) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Process pending dependency updates in batch.
	 */
	#process_pending_dependency_updates(): void {
		if (this.#pending_dependency_updates.size === 0) return;

		for (const disknode of this.#pending_dependency_updates) {
			// The disknode.imports getter will handle the actual updates
			// We just need to trigger it
			disknode.imports;
		}
		this.#pending_dependency_updates.clear();
	}

	/**
	 * Queue a disknode for dependency update.
	 */
	queue_dependency_update(disknode: Disknode): void {
		this.#pending_dependency_updates.add(disknode);
	}

	/**
	 * Process batch and handle invalidation intents iteratively to avoid deep recursion stacks.
	 */
	async #process_batch_with_intents(
		initial_batch: Filer_Change_Batch,
		processed: Set<Path_Id>,
	): Promise<void> {
		// Use a queue to process batches iteratively instead of recursively
		const batch_queue: Array<Filer_Change_Batch> = [initial_batch];

		while (batch_queue.length > 0) {
			const batch = batch_queue.shift()!;

			// Mark all disknodes in this batch as processed
			for (const change of batch.changes.values()) {
				processed.add(change.id);
			}

			// Collect intents from all phases
			const intents: Array<Filer_Invalidation_Intent> = [];

			// Execute observers by phase
			for (const phase of Filer_Phase.options) {
				const phase_intents = await this.#execute_phase(phase, batch); // eslint-disable-line no-await-in-loop
				intents.push(...phase_intents);
			}

			// Process collected intents and add any resulting batches to queue
			if (intents.length > 0) {
				const intent_batch = await this.#resolve_invalidation_intents_to_batch(intents, processed);
				if (!intent_batch.is_empty) {
					batch_queue.push(intent_batch);
				}
			}
		}
	}

	/**
	 * Resolve invalidation intents to a batch of changes without recursion.
	 */
	async #resolve_invalidation_intents_to_batch(
		intents: Array<Filer_Invalidation_Intent>,
		processed: Set<Path_Id>,
	): Promise<Filer_Change_Batch> {
		const intent_disknodes: Set<Disknode> = new Set();
		for (const intent of intents) {
			const disknodes = filer_resolve_intent_disknodes(
				intent,
				this.disknodes,
				(id: Path_Id) => this.get_disknode(id),
				filer_traverse_relationships,
			);
			for (const disknode of disknodes) {
				intent_disknodes.add(disknode);
			}
		}

		// Convert disknodes to changes
		const intent_changes: Map<Path_Id, Filer_Change> = new Map();
		for (const disknode of intent_disknodes) {
			if (processed.has(disknode.id) || disknode.is_external) continue;
			processed.add(disknode.id);
			disknode.invalidate();
			intent_changes.set(disknode.id, {
				type: 'update',
				disknode,
				id: disknode.id,
				kind: disknode.kind,
			});
		}

		return new Filer_Change_Batch(intent_changes.values());
	}

	/**
	 * Execute all observers in a phase.
	 */
	async #execute_phase(
		phase: Filer_Phase,
		batch: Filer_Change_Batch,
	): Promise<Array<Filer_Invalidation_Intent>> {
		const intents: Array<Filer_Invalidation_Intent> = [];
		const observers = this.#get_sorted_observers();

		for (const observer of observers) {
			if ((observer.phase ?? 'main') !== phase) continue;

			const filtered = this.#filter_batch_for_observer(batch, observer);
			if (filtered.is_empty) continue;

			// Pre-warm data if needed - do this AFTER expansion
			this.#prewarm_observer_data(filtered, observer);

			try {
				const result = await filer_execute_observer(observer, filtered); // eslint-disable-line no-await-in-loop
				if (observer.returns_intents && result.length > 0) {
					intents.push(...result);
				}
			} catch (error) {
				const action = observer.on_error?.(error as Error, filtered) ?? 'abort';
				if (action === 'abort') {
					this.#log?.error(`Observer ${observer.id} failed and aborted batch processing:`, error);
					throw error;
				}
				this.#log?.error(`Observer ${observer.id} failed (continuing):`, error);
			}
		}

		return intents;
	}

	/**
	 * Add a disknode to tombstones with FIFO eviction.
	 */
	#add_to_tombstones(disknode: Disknode): void {
		// Remove from main disknodes map first
		this.disknodes.delete(disknode.id);

		// Don't create tombstones if limit is 0
		if (this.tombstone_limit === 0) {
			return;
		}

		// Add to tombstones
		this.tombstones.set(disknode.id, disknode);

		// FIFO eviction if over limit
		while (this.tombstones.size > this.tombstone_limit) {
			const oldest_key = this.tombstones.keys().next().value!;
			this.tombstones.delete(oldest_key);
		}
	}

	/**
	 * Get or create a disknode for the given path.
	 */
	get_disknode(id: Path_Id): Disknode {
		this.#check_mounted();
		let disknode = this.disknodes.get(id);
		if (!disknode) {
			// Check if in tombstones and restore if found
			disknode = this.tombstones.get(id);
			if (disknode) {
				// Restore from tombstone - move back to active disknodes
				this.tombstones.delete(id);
				this.disknodes.set(id, disknode);
				disknode.exists = true; // Mark as existing again

				// Re-establish parent-child relationships
				this.#setup_disknode_relationships(disknode);

				return disknode;
			}

			// Create new disknode
			disknode = new Disknode(id, this);
			this.disknodes.set(id, disknode);

			// Check if external
			disknode.is_external = !this.#is_watched_path(id);

			// Set up relationships
			this.#setup_disknode_relationships(disknode);
		}
		return disknode;
	}

	/**
	 * Set up parent/child relationships for a disknode.
	 */
	#setup_disknode_relationships(disknode: Disknode): void {
		const parent_id = dirname(disknode.id);
		if (parent_id !== disknode.id) {
			// Not filesystem root
			const parent = this.get_disknode(parent_id);
			disknode.parent = parent;
			// Use basename of the disknode's path for the child map key
			// This is the entry name as seen by the parent directory
			parent.children.set(basename(disknode.id), disknode);
			parent.kind = 'directory';
		}
	}

	/**
	 * Check if a path is under watched directories.
	 */
	#is_watched_path(id: Path_Id): boolean {
		if (this.#watched_paths.size === 0) return true;

		for (const watched of this.#watched_paths) {
			if (watched === '/' || id === watched || id.startsWith(watched + '/')) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Map import specifier through aliases.
	 */
	map_alias(specifier: string): string {
		const matcher = this.#alias_matchers.find((m) => m.re.test(specifier));
		return matcher ? matcher.to + specifier.slice(matcher.from.length) : specifier;
	}

	/**
	 * Register an observer for filesystem changes.
	 * Returns an unsubscribe function.
	 */
	observe(observer: Filer_Observer): () => void {
		this.#observers.set(observer.id, observer);
		this.#observers_dirty = true;

		// Return unsubscribe function
		return () => {
			this.#observers.delete(observer.id);
			this.#observers_dirty = true;
		};
	}

	/**
	 * Get sorted observers, caching the result.
	 */
	#get_sorted_observers(): Array<Filer_Observer> {
		if (this.#observers_dirty) {
			this.#observers_sorted = Array.from(this.#observers.values()).sort((a, b) => {
				// Sort by phase first
				const phase_diff =
					Filer_Phase_Order[a.phase ?? 'main'] - Filer_Phase_Order[b.phase ?? 'main'];
				if (phase_diff !== 0) return phase_diff;

				// Then by priority (higher first)
				return (b.priority ?? 0) - (a.priority ?? 0);
			});
			this.#observers_dirty = false;
		}
		return this.#observers_sorted;
	}

	/**
	 * Filter batch changes based on observer configuration.
	 */
	#filter_batch_for_observer(
		batch: Filer_Change_Batch,
		observer: Filer_Observer,
	): Filer_Change_Batch {
		const filtered: Map<Path_Id, Filer_Change> = new Map();

		// Cache dynamic paths evaluation and resolve them once
		const dynamic_paths = typeof observer.paths === 'function' ? observer.paths() : observer.paths;
		const resolved_paths = dynamic_paths?.map((p: string) => resolve(p));

		// First, collect directly matching changes
		for (const [id, change] of batch.changes) {
			const disknode = change.disknode ?? this.disknodes.get(id);
			if (!disknode) continue;

			// Check observer filters
			if (filer_should_filter_disknode(observer, disknode)) continue;

			// Check matching
			if (filer_observer_matches(observer, disknode, resolved_paths)) {
				filtered.set(id, change);
			}
		}

		// Handle batch expansion
		if (observer.expand_to && observer.expand_to !== 'self') {
			this.#expand_batch(filtered, observer.expand_to, observer);
		}

		return new Filer_Change_Batch(filtered.values());
	}

	/**
	 * Expand batch based on strategy.
	 */
	#expand_batch(
		filtered: Map<Path_Id, Filer_Change>,
		strategy: Filer_Expand_Strategy,
		observer: Filer_Observer,
	): void {
		const to_add: Set<Disknode> = new Set();

		for (const [, change] of filtered) {
			const disknode = change.disknode ?? this.disknodes.get(change.id);
			if (!disknode) continue;

			switch (strategy) {
				case 'self':
					// Nothing to add for self strategy
					break;
				case 'dependents':
					for (const dep of filer_traverse_relationships(disknode, 'dependents')) {
						to_add.add(dep);
					}
					break;
				case 'dependencies':
					for (const dep of filer_traverse_relationships(disknode, 'dependencies')) {
						to_add.add(dep);
					}
					break;
				case 'all':
					for (const n of this.disknodes.values()) {
						if (!n.is_external) to_add.add(n);
					}
					break;
			}
		}

		// Add expanded disknodes
		for (const disknode of to_add) {
			if (filtered.has(disknode.id)) continue;
			if (filer_should_filter_disknode(observer, disknode)) continue;

			filtered.set(disknode.id, {
				type: 'update',
				disknode,
				id: disknode.id,
				kind: disknode.kind,
			});
		}
	}

	/**
	 * Pre-warm data for observer based on hints.
	 */
	#prewarm_observer_data(batch: Filer_Change_Batch, observer: Filer_Observer): void {
		const needs_imports = filer_observer_needs_imports(observer);

		for (const disknode of batch.all_disknodes) {
			if (observer.needs_contents) {
				disknode.contents; // Trigger lazy load
			}
			if (observer.needs_stats === true || observer.needs_stats === undefined) {
				disknode.stats; // Trigger lazy load (default: true)
			}
			if (needs_imports && disknode.is_importable) {
				disknode.imports; // Trigger import parsing
			}
		}
	}

	/**
	 * Unified relationship traversal with optimized iteration.
	 */
	*traverse_relationships(
		disknode: Disknode,
		type: 'dependents' | 'dependencies',
		recursive = true,
	): Generator<Disknode> {
		yield* filer_traverse_relationships(disknode, type, recursive);
	}

	/**
	 * Find disknodes matching a predicate.
	 */
	find_disknodes(predicate: (disknode: Disknode) => boolean): Array<Disknode> {
		const results: Array<Disknode> = [];
		for (const disknode of this.disknodes.values()) {
			if (predicate(disknode)) {
				results.push(disknode);
			}
		}
		return results;
	}

	/**
	 * Get all disknodes that depend on the given disknode.
	 */
	get_dependents(disknode: Disknode, recursive = true): Set<Disknode> {
		return new Set(filer_traverse_relationships(disknode, 'dependents', recursive));
	}

	/**
	 * Get all disknodes that the given disknode depends on.
	 */
	get_dependencies(disknode: Disknode, recursive = true): Set<Disknode> {
		return new Set(filer_traverse_relationships(disknode, 'dependencies', recursive));
	}

	/**
	 * Filter and get dependents matching a predicate.
	 */
	filter_dependents(
		disknode: Disknode,
		filter?: (id: Path_Id) => boolean,
		recursive = true,
	): Set<Path_Id> {
		const results: Set<Path_Id> = new Set();
		for (const dep of filer_traverse_relationships(disknode, 'dependents', recursive)) {
			if (!filter || filter(dep.id)) {
				results.add(dep.id);
			}
		}
		return results;
	}

	/**
	 * Get disknode by ID.
	 */
	get_by_id(id: Path_Id): Disknode | undefined {
		return this.disknodes.get(id) ?? this.tombstones.get(id);
	}

	/**
	 * Manually rescan a subtree for robustness.
	 */
	async rescan_subtree(path: string): Promise<void> {
		this.#check_mounted();
		const id = resolve(path);
		const disknode = this.disknodes.get(id);
		if (!disknode) return;

		const intent: Filer_Invalidation_Intent = {
			type: 'subtree',
			disknode,
			include_self: true,
		};

		const processed: Set<Path_Id> = new Set();
		const intent_batch = await this.#resolve_invalidation_intents_to_batch([intent], processed);
		if (!intent_batch.is_empty) {
			await this.#process_batch_with_intents(intent_batch, processed);
		}
	}

	/**
	 * Load initial stats for all disknodes in parallel.
	 */
	async load_initial_stats(): Promise<void> {
		this.#check_mounted();
		const has_watched_paths = this.#watched_paths.size > 0;
		const disknodes = Array.from(this.disknodes.values()).filter(
			(n) => !has_watched_paths || !n.is_external,
		);

		const batch_size = 100;
		for (let i = 0; i < disknodes.length; i += batch_size) {
			const batch = disknodes.slice(i, i + batch_size);
			// eslint-disable-next-line no-await-in-loop
			await Promise.all(
				batch.map(async (disknode) => {
					try {
						const file_stats = await stat(disknode.id);
						disknode.set_stats_force(file_stats);
					} catch {
						// Node doesn't exist or other error, that's okay
					}
				}),
			);
		}
	}

	/**
	 * Clean up and close the filer.
	 */
	async dispose(): Promise<void> {
		if (this.#disposed) return;
		this.#disposed = true;

		if (this.#batch_timeout) {
			clearTimeout(this.#batch_timeout);
			this.#batch_timeout = undefined;
		}

		await this.#watcher?.close();
		this.#watcher = undefined;
		this.disknodes.clear();
		this.tombstones.clear();
		this.roots.clear();
		this.#observers.clear();
		this.#observers_sorted = [];
		this.#pending_dependency_updates.clear();
	}
}
