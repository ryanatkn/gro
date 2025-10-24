import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from 'node:fs';
import {join} from 'node:path';
import type {Logger} from '@ryanatkn/belt/log.js';
import {styleText as st} from 'node:util';
import {git_current_commit_hash} from '@ryanatkn/belt/git.js';
import {z} from 'zod';

import {to_hash} from './hash.ts';
import type {Gro_Config} from './gro_config.ts';
import {paths} from './paths.ts';
import {SVELTEKIT_BUILD_DIRNAME, SVELTEKIT_DIST_DIRNAME, GRO_DIST_PREFIX} from './constants.ts';
import {to_deterministic_json} from './json_helpers.ts';

export const BUILD_CACHE_METADATA_FILENAME = 'build.json';
export const BUILD_CACHE_VERSION = '1';

/**
 * Metadata about a single build output file.
 * Includes cryptographic hash for validation plus filesystem stats for debugging and optimization.
 */
export const Build_Output_Entry = z.strictObject({
	path: z
		.string()
		.meta({description: "Relative path from project root (e.g., 'build/index.html')."}),
	hash: z.string().meta({description: 'SHA-256 hash of file contents.'}),
	size: z.number().meta({description: 'File size in bytes.'}),
	mtime: z.number().meta({description: 'Modification time in milliseconds since epoch.'}),
	ctime: z.number().meta({
		description:
			'Change time (Linux) or creation time (macOS/Windows) in milliseconds since epoch.',
	}),
	mode: z.number().meta({description: 'Unix file permission mode (e.g., 33188 = 0644).'}),
});
export type Build_Output_Entry = z.infer<typeof Build_Output_Entry>;

/**
 * Metadata stored in .gro/ directory to track build cache validity.
 * Schema validates structure at load time to catch corrupted cache files.
 */
export const Build_Cache_Metadata = z.strictObject({
	version: z.string().meta({description: 'Schema version for future compatibility.'}),
	git_commit: z.string().nullable().meta({description: 'Git commit hash at time of build.'}),
	build_cache_config_hash: z
		.string()
		.meta({description: "Hash of user's custom build_cache_config from gro.config.ts."}),
	timestamp: z.string().meta({description: 'Timestamp when build completed.'}),
	outputs: z
		.array(Build_Output_Entry)
		.meta({description: 'Build output files with hashes and filesystem stats.'}),
});
export type Build_Cache_Metadata = z.infer<typeof Build_Cache_Metadata>;

/**
 * Computes the cache key components for a build.
 * This determines whether a cached build can be reused.
 *
 * @param config Gro config
 * @param log Logger
 * @param git_commit Optional pre-computed git commit hash (optimization to avoid re-reading)
 * @param build_cache_config_hash Optional pre-computed config hash (optimization to avoid re-reading)
 */
export const compute_build_cache_key = async (
	config: Gro_Config,
	log: Logger,
	git_commit?: string | null,
	build_cache_config_hash?: string,
): Promise<{
	git_commit: string | null;
	build_cache_config_hash: string;
}> => {
	// 1. Git commit hash - primary cache key
	const commit = git_commit !== undefined ? git_commit : await git_current_commit_hash();
	if (!commit) {
		log.warn('Not in a git repository - build cache will use null git commit');
	}

	// 2. Build cache config hash - for external/dynamic inputs
	// IMPORTANT: We hash this value and never log/write the raw value (may contain secrets)
	const config_hash =
		build_cache_config_hash !== undefined
			? build_cache_config_hash
			: await hash_build_cache_config(config);

	return {
		git_commit: commit,
		build_cache_config_hash: config_hash,
	};
};

/**
 * Hashes the user's build_cache_config from gro.config.ts.
 * IMPORTANT: The raw config is never logged or written to disk, only the hash.
 */
export const hash_build_cache_config = async (config: Gro_Config): Promise<string> => {
	if (!config.build_cache_config) {
		return await to_hash(new TextEncoder().encode(''));
	}

	// Resolve if it's a function
	const resolved =
		typeof config.build_cache_config === 'function'
			? await config.build_cache_config()
			: config.build_cache_config;

	// Hash the JSON representation with deterministic key ordering
	// Note: We never log or write this raw value as it may contain secrets
	return await to_hash(new TextEncoder().encode(to_deterministic_json(resolved)));
};

/**
 * Loads build cache metadata from .gro/ directory.
 * Invalid or corrupted cache files are automatically deleted.
 */
export const load_build_cache_metadata = (): Build_Cache_Metadata | null => {
	const metadata_path = join(paths.build, BUILD_CACHE_METADATA_FILENAME);

	if (!existsSync(metadata_path)) {
		return null;
	}

	try {
		const contents = readFileSync(metadata_path, 'utf-8');
		const parsed = JSON.parse(contents);

		// Validate structure with Zod
		const metadata = Build_Cache_Metadata.parse(parsed);

		// Validate version
		if (metadata.version !== BUILD_CACHE_VERSION) {
			// Clean up stale cache with old schema version
			try {
				rmSync(metadata_path, {force: true});
			} catch {
				// Ignore cleanup errors
			}
			return null;
		}

		return metadata;
	} catch {
		// Clean up corrupted/invalid cache file
		// (catches JSON.parse, Zod validation, and version errors)
		try {
			rmSync(metadata_path, {force: true});
		} catch {
			// Ignore cleanup errors
		}
		return null;
	}
};

/**
 * Saves build cache metadata to .gro/ directory.
 * Errors are logged but don't fail the build (cache is optional).
 */
export const save_build_cache_metadata = (metadata: Build_Cache_Metadata, log?: Logger): void => {
	try {
		// Ensure .gro directory exists
		mkdirSync(paths.build, {recursive: true});

		const metadata_path = join(paths.build, BUILD_CACHE_METADATA_FILENAME);
		writeFileSync(metadata_path, JSON.stringify(metadata, null, '\t'), 'utf-8');
	} catch (error) {
		// Cache writes are optional - log warning but don't fail the build
		log?.warn(
			st('yellow', 'Failed to save build cache'),
			st('dim', `(${error instanceof Error ? error.message : String(error)})`),
		);
	}
};

/**
 * Validates that a cached build is still valid by checking stats and hashing outputs.
 * Uses size as a fast negative check before expensive hashing.
 * This is comprehensive validation to catch manual tampering or corruption.
 */
export const validate_build_cache = async (metadata: Build_Cache_Metadata): Promise<boolean> => {
	// Verify all tracked output files exist and have matching size
	for (const output of metadata.outputs) {
		if (!existsSync(output.path)) {
			return false;
		}

		// Fast negative check: size mismatch = definitely invalid
		// This avoids expensive file reads and hashing for files that have clearly changed
		const stats = statSync(output.path);
		if (stats.size !== output.size) {
			return false;
		}
	}

	// Size matches for all files - now verify content with cryptographic hashing
	// Hash all files in parallel for performance
	const hash_promises = metadata.outputs.map(async (output) => {
		try {
			const contents = readFileSync(output.path);
			const actual_hash = await to_hash(contents);
			return actual_hash === output.hash;
		} catch {
			// File deleted/inaccessible between checks = cache invalid
			return false;
		}
	});

	const results = await Promise.all(hash_promises);
	return results.every((valid) => valid);
};

/**
 * Main function to check if the build cache is valid.
 * Returns true if the cached build can be used, false if a fresh build is needed.
 *
 * @param config Gro config
 * @param log Logger
 * @param git_commit Optional pre-computed git commit hash (optimization)
 * @param build_cache_config_hash Optional pre-computed config hash (optimization)
 */
export const is_build_cache_valid = async (
	config: Gro_Config,
	log: Logger,
	git_commit?: string | null,
	build_cache_config_hash?: string,
): Promise<boolean> => {
	// Load existing metadata
	const metadata = load_build_cache_metadata();
	if (!metadata) {
		log.debug('No build cache metadata found');
		return false;
	}

	// Compute current cache key (using pre-computed values if provided)
	const current = await compute_build_cache_key(config, log, git_commit, build_cache_config_hash);

	// Check if cache keys have changed
	if (metadata.git_commit !== current.git_commit) {
		log.debug('Build cache invalid: git commit changed');
		return false;
	}

	if (metadata.build_cache_config_hash !== current.build_cache_config_hash) {
		log.debug('Build cache invalid: build_cache_config changed');
		return false;
	}

	// Comprehensive validation: verify output files
	const outputs_valid = await validate_build_cache(metadata);
	if (!outputs_valid) {
		log.debug('Build cache invalid: output files missing or corrupted');
		return false;
	}

	log.info(st('green', 'Build cache valid'), st('dim', `(from ${metadata.timestamp})`));
	return true;
};

/**
 * Collects information about all files in build output directories.
 * Returns an array of entries with path, hash, size, mtime, ctime, and mode.
 *
 * Files are hashed in parallel for performance. For very large builds (10k+ files),
 * this may take several seconds but ensures complete cache validation.
 *
 * @param build_dirs Array of output directories to scan (e.g., ['build', 'dist', 'dist_server'])
 */
export const collect_build_outputs = async (
	build_dirs: Array<string>,
): Promise<Array<Build_Output_Entry>> => {
	// Collect all files to hash first
	interface File_Entry {
		full_path: string;
		cache_key: string;
	}

	const files_to_hash: Array<File_Entry> = [];

	// Recursively collect files
	const collect_files = (dir: string, relative_base: string, dir_prefix: string): void => {
		const entries = readdirSync(dir, {withFileTypes: true});

		for (const entry of entries) {
			// Skip metadata file itself
			if (entry.name === BUILD_CACHE_METADATA_FILENAME) {
				continue;
			}

			const full_path = join(dir, entry.name);
			const relative_path = relative_base ? join(relative_base, entry.name) : entry.name;
			const cache_key = join(dir_prefix, relative_path);

			if (entry.isDirectory()) {
				collect_files(full_path, relative_path, dir_prefix);
			} else if (entry.isFile()) {
				files_to_hash.push({full_path, cache_key});
			}
			// Symlinks are intentionally ignored - we only hash regular files
		}
	};

	// Collect files from all build directories
	for (const build_dir of build_dirs) {
		if (!existsSync(build_dir)) {
			continue; // Skip non-existent directories
		}
		collect_files(build_dir, '', build_dir);
	}

	// Hash all files in parallel and collect stats
	const hash_promises = files_to_hash.map(
		async ({full_path, cache_key}): Promise<Build_Output_Entry> => {
			const stats = statSync(full_path);
			const contents = readFileSync(full_path);
			const hash = await to_hash(contents);

			return {
				path: cache_key,
				hash,
				size: stats.size,
				mtime: stats.mtimeMs,
				ctime: stats.ctimeMs,
				mode: stats.mode,
			};
		},
	);

	return await Promise.all(hash_promises);
};

/**
 * Discovers all build output directories in the current working directory.
 * Returns an array of directory names that exist: build/, dist/, dist_*
 */
export const discover_build_output_dirs = (): Array<string> => {
	const build_dirs: Array<string> = [];

	// Check for SvelteKit app output (build/)
	if (existsSync(SVELTEKIT_BUILD_DIRNAME)) {
		build_dirs.push(SVELTEKIT_BUILD_DIRNAME);
	}

	// Check for SvelteKit library output (dist/)
	if (existsSync(SVELTEKIT_DIST_DIRNAME)) {
		build_dirs.push(SVELTEKIT_DIST_DIRNAME);
	}

	// Check for server and other plugin outputs (dist_*)
	const root_entries = readdirSync('.');
	const dist_dirs = root_entries.filter((p) => {
		if (!p.startsWith(GRO_DIST_PREFIX)) return false;
		try {
			return statSync(p).isDirectory();
		} catch {
			// File was deleted/moved during iteration - skip it
			return false;
		}
	});
	build_dirs.push(...dist_dirs);

	return build_dirs;
};

/**
 * Creates build cache metadata after a successful build.
 * Automatically discovers all build output directories (build/, dist/, dist_*).
 *
 * @param config Gro config
 * @param log Logger
 * @param git_commit Optional pre-computed git commit hash (optimization)
 * @param build_cache_config_hash Optional pre-computed config hash (optimization)
 */
export const create_build_cache_metadata = async (
	config: Gro_Config,
	log: Logger,
	git_commit?: string | null,
	build_cache_config_hash?: string,
): Promise<Build_Cache_Metadata> => {
	const cache_key = await compute_build_cache_key(config, log, git_commit, build_cache_config_hash);
	const build_dirs = discover_build_output_dirs();
	const outputs = await collect_build_outputs(build_dirs);

	return {
		version: BUILD_CACHE_VERSION,
		...cache_key,
		timestamp: new Date().toISOString(),
		outputs,
	};
};
