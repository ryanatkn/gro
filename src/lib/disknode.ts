// @slop Claude Opus 4.1

import {type Stats, readFileSync, lstatSync, realpathSync} from 'node:fs';
import {basename} from 'node:path';
import {isBuiltin} from 'node:module';
import {fileURLToPath} from 'node:url';

import {parse_imports} from './parse_imports.ts';
import type {Path_Id} from './path.ts';
import {
	disknode_get_extension,
	disknode_is_typescript,
	disknode_is_js,
	disknode_is_svelte,
	disknode_is_svelte_module,
	disknode_is_importable,
	disknode_update_kind_from_stats,
	disknode_read_contents_direct,
	disknode_should_cache_contents,
} from './disknode_helpers.ts';

// TODO think about dependency injection following the api pattern
// with `parse_imports` and all of the node imports above extracted out

export interface Disknode_Api {
	map_alias: (specifier: string) => string;
	resolve_specifier: (specifier: string, base: Path_Id) => {path_id: Path_Id};
	resolve_specifier_builtin: (specifier: string, base: string) => string;
	get_disknode: (id: Path_Id) => Disknode;
}

/**
 * Represents a file or directory in the filesystem.
 * Provides lazy-loaded properties with version-based cache invalidation.
 */
export class Disknode {
	readonly id: Path_Id;
	readonly api: Disknode_Api;

	// Node type and state
	kind: 'file' | 'directory' | 'symlink' = 'file';
	is_external = false;
	exists = true; // Set to false when deleted but still referenced

	// Version counter for cache invalidation
	#version = 0;
	get version(): number {
		return this.#version;
	}

	// Lazy-loaded properties with version tracking
	#stats: Stats | null = null;
	#stats_version = -1;
	get stats_version(): number {
		return this.#stats_version;
	}

	#contents: string | null = null;
	#contents_version = -1;
	get contents_version(): number {
		return this.#contents_version;
	}

	#realpath: Path_Id | null = null;
	#realpath_version = -1;
	get realpath_version(): number {
		return this.#realpath_version;
	}

	#imports: Set<string> | null = null;
	#imports_version = -1;
	get imports_version(): number {
		return this.#imports_version;
	}

	// Relationships
	readonly dependents: Map<Path_Id, Disknode> = new Map();
	readonly dependencies: Map<Path_Id, Disknode> = new Map();
	readonly children: Map<string, Disknode> = new Map(); // For directories
	parent: Disknode | null = null;

	constructor(id: Path_Id, api: Disknode_Api) {
		this.id = id;
		this.api = api;
	}

	/**
	 * Get file stats synchronously with lazy loading and caching.
	 * Returns null if file doesn't exist.
	 */
	get stats(): Stats | null {
		if (this.#stats_version !== this.#version) {
			try {
				// Use lstat to get symlink info
				this.#stats = lstatSync(this.id);

				// Update kind based on stats
				this.kind = disknode_update_kind_from_stats(this.#stats);

				this.exists = true;
			} catch {
				this.#stats = null;
				this.exists = false;
			}
			this.#stats_version = this.#version;
		}
		return this.#stats;
	}

	/**
	 * Set stats to avoid extra syscalls.
	 * Used by Filer when stats are already available.
	 */
	set_stats(value: Stats): void {
		// Only set if not already current
		if (this.#stats_version === this.#version) return;

		this.#stats = value;
		this.#stats_version = this.#version;

		// Update kind based on stats
		this.kind = disknode_update_kind_from_stats(value);
		this.exists = true;
	}

	/**
	 * Force set stats, bypassing version check.
	 * Used for pre-populating stats in bulk operations.
	 */
	set_stats_force(value: Stats): void {
		this.#stats = value;
		this.#stats_version = this.#version;

		// Update kind based on stats
		this.kind = disknode_update_kind_from_stats(value);

		this.exists = true;
	}

	/**
	 * Get file contents synchronously with lazy loading and caching.
	 * Returns null for directories or non-existent files.
	 * Large files bypass the cache to manage memory.
	 */
	get contents(): string | null {
		if (this.#contents_version !== this.#version) {
			const stats = this.stats; // Ensure stats are fresh and kind is updated
			if (!stats || this.kind === 'directory') {
				this.#contents = null;
				this.#contents_version = this.#version;
				return null;
			}

			// For symlinks, check if the target is a directory
			let target_path = this.id;
			if (this.kind === 'symlink') {
				target_path = this.realpath;
				// Check if symlink target is a directory
				try {
					const target_stats = lstatSync(target_path);
					if (target_stats.isDirectory()) {
						this.#contents = null;
						this.#contents_version = this.#version;
						return null;
					}
				} catch {
					// Symlink target doesn't exist or is inaccessible - treat as broken symlink
					this.#contents = null;
					this.#contents_version = this.#version;
					return null;
				}
			}

			// For large files, don't cache - return directly
			if (!disknode_should_cache_contents(stats.size)) {
				return disknode_read_contents_direct(target_path);
			}

			// Cache small files
			try {
				this.#contents = readFileSync(target_path, 'utf8');
			} catch {
				this.#contents = null;
			}
			this.#contents_version = this.#version;
		}
		return this.#contents;
	}

	/**
	 * Get the real path for symlinks, or the id for regular files.
	 * Resolves symlinks recursively.
	 */
	get realpath(): Path_Id {
		if (this.#realpath_version !== this.#version) {
			const stats = this.stats; // Ensure stats are fresh and kind is updated
			if (stats && this.kind === 'symlink' && this.exists) {
				try {
					this.#realpath = realpathSync(this.id);
				} catch {
					// Broken symlink - cannot resolve target, use original path
					this.#realpath = this.id;
				}
			} else {
				this.#realpath = this.id;
			}
			this.#realpath_version = this.#version;
		}
		return this.#realpath!;
	}

	/**
	 * Get parsed imports for JavaScript/TypeScript files.
	 * Returns null for non-JS/TS files or directories.
	 * Automatically updates dependencies based on imports.
	 */
	get imports(): Set<string> | null {
		if (this.#imports_version !== this.#version) {
			// Early return if not importable - avoid contents access
			if (!this.is_importable) {
				this.#imports = null;
				this.#imports_version = this.#version;
				return null;
			}

			const contents = this.contents;
			if (!contents) {
				this.#imports = null;
			} else {
				// Parse imports from contents
				const imported = parse_imports(this.id, contents);
				this.#imports = new Set(imported);

				// Update dependencies based on imports
				this.#update_dependencies_from_imports(imported);
			}
			this.#imports_version = this.#version;
		}
		return this.#imports;
	}

	/**
	 * Update dependency relationships based on parsed imports.
	 * This is called automatically when imports are accessed.
	 */
	#update_dependencies_from_imports(imported: Array<string>): void {
		const current_deps = this.dependencies;
		const new_dep_ids: Set<Path_Id> = new Set();

		// Resolve all valid imports to dependency IDs
		for (const specifier of imported) {
			// Skip certain imports
			if (specifier.startsWith('$app/')) continue;
			if (isBuiltin(specifier)) continue;

			// Map aliases if needed
			const mapped = this.api.map_alias(specifier);

			let resolved_id: Path_Id | null = null;

			if (mapped[0] === '.' || mapped[0] === '/') {
				// Relative or absolute path
				const resolved = this.api.resolve_specifier(mapped, this.id);
				resolved_id = resolved.path_id;
			} else {
				// Package import - use pluggable resolve_specifier_builtin
				try {
					resolved_id = fileURLToPath(this.api.resolve_specifier_builtin(mapped, this.id));
				} catch (err) {
					// Failed to resolve package import - this is common and expected for many imports
					continue;
				}
			}

			if (resolved_id) {
				new_dep_ids.add(resolved_id);
			}
		}

		// Add new dependencies
		for (const dep_id of new_dep_ids) {
			if (!current_deps.has(dep_id)) {
				const dep = this.api.get_disknode(dep_id);
				this.add_dependency(dep);
			}
		}

		// Remove old dependencies that are no longer imported
		for (const [dep_id, dep] of current_deps) {
			if (!new_dep_ids.has(dep_id)) {
				this.remove_dependency(dep);
			}
		}
	}

	// Computed properties
	get mtime(): number | null {
		return this.stats?.mtimeMs ?? null;
	}

	get size(): number | null {
		// Use cached stats if available and current
		if (this.#stats_version === this.#version) {
			return this.#stats?.size ?? null;
		}
		// Lazy-load stats and return size
		return this.stats?.size ?? null;
	}

	// Calling into pure helpers for reusability
	get extension(): string {
		return disknode_get_extension(this.id);
	}

	get is_typescript(): boolean {
		return disknode_is_typescript(this.id);
	}

	get is_js(): boolean {
		return disknode_is_js(this.id);
	}

	get is_svelte(): boolean {
		return disknode_is_svelte(this.id);
	}

	get is_svelte_module(): boolean {
		return disknode_is_svelte_module(this.id);
	}

	get is_importable(): boolean {
		return disknode_is_importable(this.id);
	}

	/**
	 * Invalidate all cached properties.
	 * Next access will reload from filesystem.
	 */
	invalidate(): void {
		this.#version++;
	}

	/**
	 * Add a dependency relationship.
	 * Updates both this disknode's dependencies and the target's dependents.
	 */
	add_dependency(dep: Disknode): void {
		this.dependencies.set(dep.id, dep);
		dep.dependents.set(this.id, this);
	}

	/**
	 * Remove a dependency relationship.
	 * Updates both this disknode's dependencies and the target's dependents.
	 */
	remove_dependency(dep: Disknode): void {
		this.dependencies.delete(dep.id);
		dep.dependents.delete(this.id);
	}

	/**
	 * Clear all dependency relationships.
	 * Used when node is deleted.
	 */
	clear_relationships(): void {
		// Remove this node from others' maps
		for (const dep of this.dependencies.values()) {
			dep.dependents.delete(this.id);
		}
		for (const dep of this.dependents.values()) {
			dep.dependencies.delete(this.id);
		}
		// Clear this node's maps
		this.dependencies.clear();
		this.dependents.clear();
	}

	/**
	 * Get all ancestor disknodes up to the root.
	 */
	get_ancestors(): Array<Disknode> {
		const ancestors: Array<Disknode> = [];
		let current = this.parent;
		while (current) {
			ancestors.push(current);
			current = current.parent;
		}
		return ancestors;
	}

	/**
	 * Get all descendant disknodes recursively.
	 * Uses iterative approach to avoid stack overflow on deep trees.
	 */
	get_descendants(): Array<Disknode> {
		const descendants: Array<Disknode> = [];
		const stack = Array.from(this.children.values());
		while (stack.length > 0) {
			const disknode = stack.pop()!;
			descendants.push(disknode);
			stack.push(...disknode.children.values());
		}
		return descendants;
	}

	/**
	 * Get a child disknode by name.
	 */
	get_child(name: string): Disknode | undefined {
		return this.children.get(name);
	}

	/**
	 * Check if this node is an ancestor of another.
	 */
	is_ancestor_of(disknode: Disknode): boolean {
		let current = disknode.parent;
		while (current) {
			if (current === this) return true;
			current = current.parent;
		}
		return false;
	}

	/**
	 * Get the relative path from this disknode to another disknode.
	 * Returns null if they're not in the same tree.
	 */
	relative_to(disknode: Disknode): string | null {
		// Special case: same node
		if (this === disknode) return '';

		// Find common ancestor
		const this_ancestors = [this, ...this.get_ancestors()];
		const disknode_ancestors = [disknode, ...disknode.get_ancestors()];

		let common: Disknode | null = null;
		for (const ancestor of this_ancestors) {
			if (disknode_ancestors.includes(ancestor)) {
				common = ancestor;
				break;
			}
		}

		if (!common) return null;

		// Count steps up from this to common
		let steps_up = 0;
		let up_current = this as Disknode;
		while (up_current !== common) {
			steps_up++;
			up_current = up_current.parent!;
		}

		// Build path down from common to target
		const down_path: Array<string> = [];
		let down_current = disknode;
		while (down_current !== common) {
			down_path.unshift(basename(down_current.id));
			down_current = down_current.parent!;
		}

		// If this is the common ancestor, just return the down path
		if (steps_up === 0) {
			return down_path.join('/');
		}

		// Otherwise, build up path + down path
		const up_path = '../'.repeat(steps_up);
		const result = up_path + down_path.join('/');

		// Remove trailing slash if we only went up
		return down_path.length === 0 ? result.slice(0, -1) : result;
	}

	/**
	 * Get the relative path from another disknode to this disknode.
	 * Returns null if they're not in the same tree.
	 */
	relative_from(disknode: Disknode): string | null {
		return disknode.relative_to(this);
	}
}
