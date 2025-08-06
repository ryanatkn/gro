// @slop Claude Opus 4.1

import {z} from 'zod';
import {resolve} from 'node:path';

import type {Disknode} from './disknode.ts';
import type {Path_Id} from './path.ts';

/**
 * Change types as const for faster coalescing.
 * Use Filer_Change_Type.options to get ['add', 'update', 'delete'] array.
 */
export const Filer_Change_Type = z.enum(['add', 'update', 'delete']);
export type Filer_Change_Type = z.infer<typeof Filer_Change_Type>;

/**
 * Observer execution phases.
 * Use Filer_Phase.options to get ['pre', 'main', 'post'] array.
 */
export const Filer_Phase = z.enum(['pre', 'main', 'post']);
export type Filer_Phase = z.infer<typeof Filer_Phase>;

/**
 * Phase execution order for sorting.
 */
export const Filer_Phase_Order: Record<Filer_Phase, number> = {
	pre: 0,
	main: 1,
	post: 2,
};

/**
 * Batch expansion strategies.
 * Use Filer_Expand_Strategy.options to get ['self', 'dependents', 'dependencies', 'all'] array.
 */
export const Filer_Expand_Strategy = z.enum(['self', 'dependents', 'dependencies', 'all']);
export type Filer_Expand_Strategy = z.infer<typeof Filer_Expand_Strategy>;

/**
 * Error handling strategies.
 * Use Filer_Error_Strategy.options to get ['continue', 'abort'] array.
 */
export const Filer_Error_Strategy = z.enum(['continue', 'abort']);
export type Filer_Error_Strategy = z.infer<typeof Filer_Error_Strategy>;

/**
 * File system node kinds.
 * Use Filer_Node_Kind.options to get ['file', 'directory', 'symlink'] array.
 */
export const Filer_Node_Kind = z.enum(['file', 'directory', 'symlink']);
export type Filer_Node_Kind = z.infer<typeof Filer_Node_Kind>;

/**
 * Invalidation intent types.
 * Use Filer_Invalidation_Intent_Type.options to get array of all values.
 */
export const Filer_Invalidation_Intent_Type = z.enum([
	'all',
	'paths',
	'pattern',
	'dependents',
	'dependencies',
	'subtree',
]);
export type Filer_Invalidation_Intent_Type = z.infer<typeof Filer_Invalidation_Intent_Type>;

/**
 * Invalidation intent returned by observers to trigger additional changes.
 */
export const Filer_Invalidation_Intent = z.strictObject({
	type: Filer_Invalidation_Intent_Type,
	paths: z.array(z.string()).optional(), // For 'paths' type
	pattern: z.instanceof(RegExp).optional(), // For 'pattern' type
	disknode: z.custom<Disknode>().optional(), // For 'dependents'/'dependencies'/'subtree' types
	include_self: z.boolean().optional(), // For 'subtree' type
});
export type Filer_Invalidation_Intent = z.infer<typeof Filer_Invalidation_Intent>;

export const Filer_Change = z.strictObject({
	type: Filer_Change_Type,
	disknode: z.custom<Disknode>().optional(), // Present for add/update
	id: z.string(), // Path_Id
	kind: Filer_Node_Kind,
});
export type Filer_Change = z.infer<typeof Filer_Change>;

/**
 * Batch of filesystem changes delivered to observers.
 */
export class Filer_Change_Batch {
	readonly changes: Map<Path_Id, Filer_Change> = new Map();

	// Cached accessors
	#added?: Array<Disknode>;
	#updated?: Array<Disknode>;
	#deleted?: Array<Path_Id>;
	#all_disknodes?: Array<Disknode>;

	constructor(changes: Iterable<Filer_Change> = []) {
		for (const change of changes) {
			this.changes.set(change.id, change);
		}
	}

	/** Get all added disknodes */
	get added(): Array<Disknode> {
		if (!this.#added) {
			this.#added = [];
			for (const change of this.changes.values()) {
				if (change.type === 'add' && change.disknode) {
					this.#added.push(change.disknode);
				}
			}
		}
		return this.#added;
	}

	/** Get all updated disknodes */
	get updated(): Array<Disknode> {
		if (!this.#updated) {
			this.#updated = [];
			for (const change of this.changes.values()) {
				if (change.type === 'update' && change.disknode) {
					this.#updated.push(change.disknode);
				}
			}
		}
		return this.#updated;
	}

	/** Get all deleted disknode IDs */
	get deleted(): Array<Path_Id> {
		if (!this.#deleted) {
			this.#deleted = [];
			for (const change of this.changes.values()) {
				if (change.type === 'delete') {
					this.#deleted.push(change.id);
				}
			}
		}
		return this.#deleted;
	}

	/** Get all disknodes (added + updated) */
	get all_disknodes(): Array<Disknode> {
		if (!this.#all_disknodes) {
			this.#all_disknodes = [];
			for (const change of this.changes.values()) {
				if (change.disknode) this.#all_disknodes.push(change.disknode);
			}
		}
		return this.#all_disknodes;
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
 * Observer configuration for watching filesystem changes.
 */
export interface Filer_Observer {
	/** Unique identifier for this observer */
	id: string;

	// Matching strategies (at least one required)
	/** Regex patterns to match file paths */
	patterns?: Array<RegExp>;
	/** Specific paths to watch (can be a function for dynamic paths - should be pure and cheap) */
	paths?: Array<string> | (() => Array<string>);
	/** Custom matching function */
	match?: (disknode: Disknode) => boolean;

	// What changes to track
	/** Track external (non-watched) files. Default: false */
	track_external?: boolean;
	/** Track directory changes. Default: false */
	track_directories?: boolean;

	// Batch expansion strategy
	/** How to expand the batch beyond matched files. Default: 'self' */
	expand_to?: Filer_Expand_Strategy;

	// Intent support
	/** Whether this observer can return invalidation intents. Default: false */
	returns_intents?: boolean;

	// Performance hints
	/** Whether this observer needs file contents. Default: false */
	needs_contents?: boolean;
	/** Whether this observer needs file stats. Default: true */
	needs_stats?: boolean;
	/** Whether this observer needs parsed imports for dependency tracking. Default: false */
	needs_imports?: boolean;

	// Execution order
	/** Execution phase. Default: 'main' */
	phase?: Filer_Phase;
	/** Priority within phase (higher = earlier). Default: 0 */
	priority?: number;

	// Error handling
	/** How to handle errors. Default: 'abort' */
	on_error?: (error: Error, batch: Filer_Change_Batch) => Filer_Error_Strategy;
	/** Timeout for observer execution. Default: 30000ms */
	timeout_ms?: number;

	/** Change handler - can be async and return invalidation intents */
	on_change: (
		batch: Filer_Change_Batch,
	) =>
		| Array<Filer_Invalidation_Intent>
		| void
		| Promise<Array<Filer_Invalidation_Intent>>
		| Promise<void>;
}

export const Filer_Change_Transitions: Record<
	Filer_Change_Type,
	Record<Filer_Change_Type, Filer_Change_Type | null>
> = {
	add: {
		add: 'add', // add + add → add (shouldn't happen but handle it)
		update: 'add', // add + update → add (preserve add semantic)
		delete: null, // add + delete → remove entirely
	},
	update: {
		add: 'add', // update + add → add (shouldn't happen but handle it)
		update: 'update', // update + update → update
		delete: 'delete', // update + delete → delete
	},
	delete: {
		add: 'update', // delete + add → update (recreated)
		update: 'update', // delete + update → update (shouldn't happen but handle it)
		delete: 'delete', // delete + delete → delete
	},
};

/**
 * Helper for regex matching with automatic lastIndex reset.
 */
export const filer_test_regex = (pattern: RegExp, str: string): boolean => {
	if (pattern.global || pattern.sticky) {
		pattern.lastIndex = 0;
	}
	return pattern.test(str);
};

/**
 * Coalesce change events using lookup table.
 */
export const filer_coalesce_change = (
	prev: Filer_Change | undefined,
	next: Filer_Change,
): Filer_Change | null => {
	if (!prev) return next;

	const result = Filer_Change_Transitions[prev.type][next.type];

	if (result === null) return null; // Remove entry

	// Return coalesced change
	return {...next, type: result};
};

/**
 * Check if disknode should be filtered out based on observer settings.
 */
export const filer_should_filter_disknode = (
	observer: Filer_Observer,
	disknode: Disknode,
): boolean => {
	return (
		(!observer.track_external && disknode.is_external) ||
		(!observer.track_directories && disknode.kind === 'directory')
	);
};

/**
 * Check if an observer matches a disknode.
 */
export const filer_observer_matches = (
	observer: Filer_Observer,
	disknode: Disknode,
	resolved_paths?: Array<Path_Id>,
): boolean => {
	if (observer.match?.(disknode)) return true;

	if (observer.patterns) {
		for (const pattern of observer.patterns) {
			if (filer_test_regex(pattern, disknode.id)) return true;
		}
	}

	if (resolved_paths) {
		for (const path of resolved_paths) {
			if (disknode.id === path) return true;
		}
	}

	return false;
};

/**
 * Execute an observer with timeout protection.
 */
export const filer_execute_observer = async (
	observer: Filer_Observer,
	batch: Filer_Change_Batch,
): Promise<Array<Filer_Invalidation_Intent>> => {
	const timeout = observer.timeout_ms ?? 30000;
	let timer: NodeJS.Timeout | undefined;

	try {
		const result = await Promise.race([
			Promise.resolve(observer.on_change(batch)),
			new Promise<never>((_, reject) => {
				timer = setTimeout(() => {
					const error = new Error(`Observer ${observer.id} timed out after ${timeout}ms`);
					error.name = 'ObserverTimeoutError';
					reject(error);
				}, timeout);
			}),
		]);

		return Array.isArray(result) ? result : [];
	} finally {
		if (timer) clearTimeout(timer);
	}
};

/**
 * Unified relationship traversal with optimized iteration.
 */
export function* filer_traverse_relationships(
	disknode: Disknode,
	type: 'dependents' | 'dependencies',
	recursive = true,
): Generator<Disknode> {
	const visited: Set<Disknode> = new Set([disknode]);
	const stack = [disknode];

	while (stack.length > 0) {
		const current = stack.pop()!;
		const relationships = type === 'dependents' ? current.dependents : current.dependencies;

		for (const related of relationships.values()) {
			if (!visited.has(related)) {
				visited.add(related);
				yield related;
				if (recursive) {
					stack.push(related);
				}
			}
		}
	}
}

/**
 * Resolve an invalidation intent to affected disknodes.
 */
export const filer_resolve_intent_disknodes = (
	intent: Filer_Invalidation_Intent,
	disknodes: Map<Path_Id, Disknode>,
	get_disknode: (id: Path_Id) => Disknode,
	traverse_relationships: typeof filer_traverse_relationships,
): Set<Disknode> => {
	const result_disknodes: Set<Disknode> = new Set();

	switch (intent.type) {
		case 'all':
			for (const disknode of disknodes.values()) {
				if (!disknode.is_external) result_disknodes.add(disknode);
			}
			break;

		case 'paths':
			if (intent.paths) {
				for (const path of intent.paths) {
					const disknode = get_disknode(resolve(path));
					if (!disknode.is_external) result_disknodes.add(disknode);
				}
			}
			break;

		case 'pattern':
			if (intent.pattern) {
				for (const disknode of disknodes.values()) {
					if (!disknode.is_external && filer_test_regex(intent.pattern, disknode.id)) {
						result_disknodes.add(disknode);
					}
				}
			}
			break;

		case 'dependents':
			if (intent.disknode) {
				for (const dep of traverse_relationships(intent.disknode, 'dependents')) {
					if (!dep.is_external) result_disknodes.add(dep);
				}
			}
			break;

		case 'dependencies':
			if (intent.disknode) {
				for (const dep of traverse_relationships(intent.disknode, 'dependencies')) {
					if (!dep.is_external) result_disknodes.add(dep);
				}
			}
			break;

		case 'subtree':
			if (intent.disknode) {
				if (intent.include_self && !intent.disknode.is_external) {
					result_disknodes.add(intent.disknode);
				}
				for (const desc of intent.disknode.get_descendants()) {
					if (!desc.is_external) result_disknodes.add(desc);
				}
			}
			break;
	}

	return result_disknodes;
};
