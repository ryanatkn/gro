// @slop Claude Sonnet 4

import {parse_imports} from './parse_imports.ts';
import {Parse_Imports_Worker_Pool} from './parse_imports_worker_pool.ts';
import type {Path_Id} from './path.ts';

export interface Parse_Imports_Async_Options {
	worker_enabled?: boolean;
	worker_pool_size?: number;
	worker_timeout_ms?: number;
	sync_threshold_bytes?: number; // Use sync parsing for files smaller than this
}

/**
 * Async wrapper for parse_imports that can use worker threads for better performance.
 * Falls back to synchronous parsing for small files or when workers are disabled.
 */
export class Parse_Imports_Async {
	readonly #worker_pool: Parse_Imports_Worker_Pool | null;
	readonly #worker_enabled: boolean;
	readonly #sync_threshold_bytes: number;

	constructor(options: Parse_Imports_Async_Options = {}) {
		this.#worker_enabled = options.worker_enabled ?? true;
		this.#sync_threshold_bytes = options.sync_threshold_bytes ?? 1024; // 1KB

		if (this.#worker_enabled) {
			this.#worker_pool = new Parse_Imports_Worker_Pool({
				size: options.worker_pool_size,
				timeout_ms: options.worker_timeout_ms,
			});
		} else {
			this.#worker_pool = null;
		}
	}

	/**
	 * Parse imports from file contents.
	 * Uses workers for large files, synchronous parsing for small files.
	 */
	async parse_imports(
		path_id: Path_Id,
		contents: string,
		ignore_types = true,
	): Promise<Array<string>> {
		// Use synchronous parsing for small files to avoid worker overhead
		if (!this.#worker_enabled || contents.length < this.#sync_threshold_bytes) {
			return parse_imports(path_id, contents, ignore_types);
		}

		// Use worker pool for larger files
		if (this.#worker_pool) {
			try {
				return await this.#worker_pool.parse_imports(path_id, contents, ignore_types);
			} catch (error) {
				// Fallback to synchronous parsing on worker failure
				return parse_imports(path_id, contents, ignore_types);
			}
		}

		// Fallback if no worker pool available
		return parse_imports(path_id, contents, ignore_types);
	}

	/**
	 * Parse imports for multiple files in parallel.
	 * Efficiently batches requests to workers.
	 */
	async parse_imports_batch(
		requests: Array<{path_id: Path_Id; contents: string; ignore_types?: boolean}>,
	): Promise<Map<Path_Id, Array<string>>> {
		if (!this.#worker_enabled || !this.#worker_pool) {
			// Process synchronously if workers disabled
			const results = new Map<Path_Id, Array<string>>();
			for (const req of requests) {
				try {
					const imports = parse_imports(req.path_id, req.contents, req.ignore_types ?? true);
					results.set(req.path_id, imports);
				} catch (error) {
					// Skip failed parses - they'll return empty results
				}
			}
			return results;
		}

		// Separate small and large files
		const small_files: Array<{path_id: Path_Id; contents: string; ignore_types: boolean}> = [];
		const large_files: Array<{path_id: Path_Id; contents: string; ignore_types: boolean}> = [];

		for (const req of requests) {
			const normalized = {
				path_id: req.path_id,
				contents: req.contents,
				ignore_types: req.ignore_types ?? true,
			};

			if (req.contents.length < this.#sync_threshold_bytes) {
				small_files.push(normalized);
			} else {
				large_files.push(normalized);
			}
		}

		// Process both in parallel
		const [small_results, large_results] = await Promise.all([
			this.#process_small_files_sync(small_files),
			this.#worker_pool.parse_imports_batch(large_files),
		]);

		// Combine results
		const combined = new Map<Path_Id, Array<string>>();
		for (const [path_id, imports] of small_results.entries()) {
			combined.set(path_id, imports);
		}
		for (const [path_id, imports] of large_results.entries()) {
			combined.set(path_id, imports);
		}

		return combined;
	}

	/**
	 * Process small files synchronously.
	 */
	#process_small_files_sync(
		files: Array<{path_id: Path_Id; contents: string; ignore_types: boolean}>,
	): Map<Path_Id, Array<string>> {
		const results = new Map<Path_Id, Array<string>>();
		for (const file of files) {
			try {
				const imports = parse_imports(file.path_id, file.contents, file.ignore_types);
				results.set(file.path_id, imports);
			} catch (error) {
				// Skip failed parses
			}
		}
		return results;
	}

	/**
	 * Clean up worker pool.
	 */
	async dispose(): Promise<void> {
		if (this.#worker_pool) {
			await this.#worker_pool.dispose();
		}
	}
}
