import {existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import type {Logger} from '@ryanatkn/belt/log.js';
import {styleText as st} from 'node:util';
import {git_current_commit_hash} from '@ryanatkn/belt/git.js';

import {to_hash} from './hash.ts';
import type {Gro_Config} from './gro_config.ts';
import {paths} from './paths.ts';
import {SVELTEKIT_BUILD_DIRNAME, SVELTEKIT_DIST_DIRNAME, GRO_DIST_PREFIX} from './constants.ts';

const BUILD_CACHE_METADATA_FILENAME = 'build.json';
const BUILD_CACHE_VERSION = '1';

/**
 * Metadata stored in .gro/ directory to track build cache validity.
 */
export interface Build_Cache_Metadata {
	/**
	 * Schema version for future compatibility.
	 */
	version: string;
	/**
	 * Git commit hash at time of build.
	 */
	git_commit: string | null;
	/**
	 * Hash of user's custom build_cache_config from gro.config.ts.
	 */
	build_cache_config_hash: string;
	/**
	 * Timestamp when build completed.
	 */
	timestamp: string;
	/**
	 * Hashes of build output files for validation.
	 * Keys are relative paths including directory prefix (e.g., "build/index.html", "dist/index.js").
	 */
	output_hashes: Record<string, string>;
}

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
		return await to_hash(Buffer.from('', 'utf-8'));
	}

	// Resolve if it's a function
	const resolved =
		typeof config.build_cache_config === 'function'
			? await config.build_cache_config()
			: config.build_cache_config;

	// Hash the JSON representation
	// Note: We never log or write this raw value as it may contain secrets
	return await to_hash(Buffer.from(JSON.stringify(resolved), 'utf-8'));
};

/**
 * Loads build cache metadata from .gro/ directory.
 */
export const load_build_cache_metadata = (): Build_Cache_Metadata | null => {
	const metadata_path = join(paths.build, BUILD_CACHE_METADATA_FILENAME);

	if (!existsSync(metadata_path)) {
		return null;
	}

	try {
		const contents = readFileSync(metadata_path, 'utf-8');
		const metadata = JSON.parse(contents) as Build_Cache_Metadata;

		// Validate version
		if (metadata.version !== BUILD_CACHE_VERSION) {
			return null;
		}

		return metadata;
	} catch {
		return null;
	}
};

/**
 * Saves build cache metadata to .gro/ directory.
 */
export const save_build_cache_metadata = (metadata: Build_Cache_Metadata): void => {
	// Ensure .gro directory exists
	mkdirSync(paths.build, {recursive: true});

	const metadata_path = join(paths.build, BUILD_CACHE_METADATA_FILENAME);
	writeFileSync(metadata_path, JSON.stringify(metadata, null, '\t'), 'utf-8');
};

/**
 * Validates that a cached build is still valid by hashing outputs.
 * This is comprehensive validation to catch manual tampering or corruption.
 */
export const validate_build_cache = async (metadata: Build_Cache_Metadata): Promise<boolean> => {
	// Verify all tracked output files still exist and match their hashes
	for (const [file_path, expected_hash] of Object.entries(metadata.output_hashes)) {
		// file_path includes directory prefix (e.g., "build/index.html")
		if (!existsSync(file_path)) {
			return false;
		}

		// Verify hash matches (output_hashes only contains files, not directories)
		const contents = readFileSync(file_path);
		const actual_hash = await to_hash(contents); // eslint-disable-line no-await-in-loop

		if (actual_hash !== expected_hash) {
			return false;
		}
	}

	return true;
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
 * Hashes critical files in build output directories for validation.
 * Returns a map of relative file paths (with directory prefix) to their hashes.
 *
 * Note: Hashes all files by default. For very large builds, this may take
 * a few seconds but ensures complete cache validation.
 *
 * @param build_dirs Array of output directories to hash (e.g., ['build', 'dist', 'dist_server'])
 * @param max_files Optional limit on total files to hash across all directories
 */
export const hash_build_outputs = async (
	build_dirs: Array<string>,
	max_files: number | null = null,
): Promise<Record<string, string>> => {
	const output_hashes: Record<string, string> = {};
	let file_count = 0;

	// Recursively hash files
	const hash_directory = async (
		dir: string,
		relative_base: string,
		dir_prefix: string,
	): Promise<void> => {
		if (max_files !== null && file_count >= max_files) {
			return; // Limit reached
		}

		const entries = readdirSync(dir, {withFileTypes: true});

		for (const entry of entries) {
			if (max_files !== null && file_count >= max_files) {
				break;
			}

			// Skip metadata file itself
			if (entry.name === BUILD_CACHE_METADATA_FILENAME) {
				continue;
			}

			const full_path = join(dir, entry.name);
			const relative_path = relative_base ? join(relative_base, entry.name) : entry.name;
			// Prefix with directory name for the cache key
			const cache_key = join(dir_prefix, relative_path);

			if (entry.isDirectory()) {
				await hash_directory(full_path, relative_path, dir_prefix); // eslint-disable-line no-await-in-loop
			} else if (entry.isFile()) {
				const contents = readFileSync(full_path);
				const hash = await to_hash(contents); // eslint-disable-line no-await-in-loop
				output_hashes[cache_key] = hash;
				file_count++;
			}
		}
	};

	// Hash each build directory
	for (const build_dir of build_dirs) {
		if (!existsSync(build_dir)) {
			continue; // Skip non-existent directories
		}

		await hash_directory(build_dir, '', build_dir); // eslint-disable-line no-await-in-loop
	}

	return output_hashes;
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
	const dist_dirs = root_entries.filter(
		(p) => p.startsWith(GRO_DIST_PREFIX) && statSync(p).isDirectory(),
	);
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
	const output_hashes = await hash_build_outputs(build_dirs);

	return {
		version: BUILD_CACHE_VERSION,
		...cache_key,
		timestamp: new Date().toISOString(),
		output_hashes,
	};
};
