import {type Stats, readFileSync, lstatSync, realpathSync} from 'node:fs';
import {basename} from 'node:path';
import {isBuiltin} from 'node:module';
import {fileURLToPath} from 'node:url';

import type {Filer} from './filer.ts';
import {parse_imports} from './parse_imports.ts';
import {resolve_specifier} from './resolve_specifier.ts';
import type {Path_Id} from './path.ts';

/**
 * Represents a file or directory in the filesystem.
 * Provides lazy-loaded properties with version-based cache invalidation.
 */
export class Disknode {
	readonly id: Path_Id;
	readonly filer: Filer;

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

	constructor(id: Path_Id, filer: Filer) {
		this.id = id;
		this.filer = filer;
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
				if (this.#stats.isDirectory()) {
					this.kind = 'directory';
				} else if (this.#stats.isSymbolicLink()) {
					this.kind = 'symlink';
				} else {
					this.kind = 'file';
				}

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
	 * Only sets stats if they haven't been loaded yet.
	 * Used by Filer when stats are already available from chokidar.
	 */
	set stats(value: Stats | null) {
		if (this.#stats_version === this.#version) {
			return;
		}

		this.#stats = value;
		this.#stats_version = this.#version;

		if (value) {
			// Update kind based on stats
			if (value.isDirectory()) {
				this.kind = 'directory';
			} else if (value.isSymbolicLink()) {
				this.kind = 'symlink';
			} else {
				this.kind = 'file';
			}

			this.exists = true;
		} else {
			this.exists = false;
		}
	}

	/**
	 * Force set stats, bypassing version check.
	 * Used for pre-populating stats in bulk operations.
	 */
	set_stats_force(value: Stats): void {
		this.#stats = value;
		this.#stats_version = this.#version;

		// Update kind based on stats
		if (value.isDirectory()) {
			this.kind = 'directory';
		} else if (value.isSymbolicLink()) {
			this.kind = 'symlink';
		} else {
			this.kind = 'file';
		}

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
			} else {
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
						// Target doesn't exist, treat as broken symlink
						this.#contents = null;
						this.#contents_version = this.#version;
						return null;
					}
				}

				if (stats.size > Disknode.MAX_CACHED_SIZE) {
					// Don't cache large files, read on demand
					try {
						return readFileSync(target_path, 'utf8');
					} catch {
						return null;
					}
				} else {
					try {
						this.#contents = readFileSync(target_path, 'utf8');
					} catch {
						this.#contents = null;
					}
				}
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
					// Broken symlink
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
			const contents = this.contents;
			if (!contents || !this.is_importable) {
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
		const dependencies_before = new Set(this.dependencies.keys());
		const dependencies_removed = new Set(dependencies_before);

		for (const specifier of imported) {
			// Skip certain imports
			if (specifier.startsWith('$app/')) continue;
			if (isBuiltin(specifier)) continue;

			// Map aliases if needed
			const mapped = this.filer.map_alias(specifier);

			let resolved_id: Path_Id | null = null;

			if (mapped[0] === '.' || mapped[0] === '/') {
				// Relative or absolute path
				const resolved = resolve_specifier(mapped, this.id);
				resolved_id = resolved.path_id;
			} else {
				// Package import - use import.meta.resolve
				try {
					const file_url = new URL(this.id, 'file://');
					resolved_id = fileURLToPath(import.meta.resolve(mapped, file_url.href));
				} catch {
					// Failed to resolve, skip
					continue;
				}
			}

			if (resolved_id) {
				dependencies_removed.delete(resolved_id);
				if (!dependencies_before.has(resolved_id)) {
					const dep = this.filer.get_disknode(resolved_id);
					this.add_dependency(dep);
				}
			}
		}

		// Remove old dependencies
		for (const dep_id of dependencies_removed) {
			const dep = this.filer.get_disknode(dep_id);
			this.remove_dependency(dep);
		}
	}

	// Computed properties
	get mtime(): number | null {
		return this.stats?.mtimeMs ?? null;
	}

	get size(): number | null {
		// Use cached stats if available and current, otherwise lazy-load
		if (this.#stats_version === this.#version && this.#stats) {
			return this.#stats.size;
		}
		return this.stats?.size ?? null;
	}

	get extension(): string {
		const filename = basename(this.id);
		const index = filename.lastIndexOf('.');
		// Hidden files (starting with .) should not be considered to have extensions
		// unless they have a second dot (e.g., .env.local has .local extension)
		if (index <= 0 || (index === 0 && !filename.slice(1).includes('.'))) {
			return '';
		}
		return filename.slice(index);
	}

	get is_typescript(): boolean {
		return /\.[cm]?tsx?$/.test(this.id);
	}

	get is_js(): boolean {
		return /\.[cm]?jsx?$/.test(this.id);
	}

	get is_svelte(): boolean {
		return this.id.endsWith('.svelte');
	}

	get is_svelte_module(): boolean {
		return this.id.endsWith('.svelte');
	}

	get is_importable(): boolean {
		return this.is_typescript || this.is_js || this.is_svelte;
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
	 * Updates both this node's dependencies and the target's dependents.
	 */
	add_dependency(dep: Disknode): void {
		this.dependencies.set(dep.id, dep);
		dep.dependents.set(this.id, this);
	}

	/**
	 * Remove a dependency relationship.
	 * Updates both this node's dependencies and the target's dependents.
	 */
	remove_dependency(dep: Disknode): void {
		this.dependencies.delete(dep.id);
		dep.dependents.delete(this.id);
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
			const node = stack.pop()!;
			descendants.push(node);
			stack.push(...node.children.values());
		}
		return descendants;
	}

	/**
	 * Get a child node by name.
	 */
	get_child(name: string): Disknode | undefined {
		return this.children.get(name);
	}

	/**
	 * Check if this node is an ancestor of another.
	 */
	is_ancestor_of(node: Disknode): boolean {
		let current = node.parent;
		while (current) {
			if (current === this) return true;
			current = current.parent;
		}
		return false;
	}

	/**
	 * Get the relative path from this node to another node.
	 * Returns null if they're not in the same tree.
	 */
	relative_to(node: Disknode): string | null {
		// Special case: same node
		if (this === node) return '';

		// Find common ancestor
		const this_ancestors = [this, ...this.get_ancestors()];
		const node_ancestors = [node, ...node.get_ancestors()];

		let common: Disknode | null = null;
		for (const ancestor of this_ancestors) {
			if (node_ancestors.includes(ancestor)) {
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
		let down_current = node;
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
	 * Get the relative path from another node to this node.
	 * Returns null if they're not in the same tree.
	 */
	relative_from(node: Disknode): string | null {
		return node.relative_to(this);
	}

	// Constants
	static readonly MAX_CACHED_SIZE = 10 * 1024 * 1024; // 10MB
}
