// @slop Claude Opus 4.1

import {readFileSync, type Stats} from 'node:fs';
import {basename} from 'node:path';

import type {Path_Id} from './path.ts';

/**
 * Maximum file size to cache in memory (10MB).
 */
export const DISKNODE_MAX_CACHED_SIZE = 10 * 1024 * 1024;

/**
 * Get file extension from a path.
 * Hidden files (starting with .) should not be considered to have extensions
 * unless they have a second dot (e.g., .env.local has .local extension).
 */
export const disknode_get_extension = (id: Path_Id): string => {
	const filename = basename(id);
	const index = filename.lastIndexOf('.');
	// Hidden files (starting with .) should not be considered to have extensions
	// unless they have a second dot (e.g., .env.local has .local extension)
	if (index <= 0 || (index === 0 && filename.indexOf('.', 1) === -1)) {
		return '';
	}
	return filename.slice(index);
};

/**
 * Check if a path is a TypeScript file.
 */
export const disknode_is_typescript = (id: Path_Id): boolean => /\.[cm]?tsx?$/.test(id);

/**
 * Check if a path is a JS file.
 */
export const disknode_is_js = (id: Path_Id): boolean => /\.[cm]?jsx?$/.test(id);

/**
 * Check if a path is a Svelte file.
 */
export const disknode_is_svelte = (id: Path_Id): boolean => id.endsWith('.svelte');

/**
 * Check if a path is a Svelte TS or JS runes module.
 */
export const disknode_is_svelte_module = (id: Path_Id): boolean =>
	id.includes('.svelte.') && (disknode_is_typescript(id) || disknode_is_js(id));

/**
 * Check if a file is importable (TypeScript, JS, Svelte, or Svelte modules).
 */
export const disknode_is_importable = (id: Path_Id): boolean =>
	disknode_is_typescript(id) ||
	disknode_is_js(id) ||
	disknode_is_svelte(id) ||
	disknode_is_svelte_module(id);

/**
 * Update disknode kind based on stats.
 */
export const disknode_update_kind_from_stats = (stats: Stats): 'file' | 'directory' | 'symlink' => {
	if (stats.isDirectory()) {
		return 'directory';
	} else if (stats.isSymbolicLink()) {
		return 'symlink';
	} else {
		return 'file';
	}
};

/**
 * Read file contents directly without caching (for large files).
 * Returns null if the file cannot be read.
 */
export const disknode_read_contents_direct = (target_path: Path_Id): string | null => {
	try {
		return readFileSync(target_path, 'utf8');
	} catch {
		return null;
	}
};

/**
 * Check if file size exceeds cache threshold.
 */
export const disknode_should_cache_contents = (size: number): boolean =>
	size <= DISKNODE_MAX_CACHED_SIZE;
