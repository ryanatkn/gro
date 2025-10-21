import {existsSync, readdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import type {Logger} from '@ryanatkn/belt/log.js';
import {styleText as st} from 'node:util';

import {to_hash} from './hash.ts';
import {git_current_commit_hash} from './git.ts';
import type {Gro_Config} from './gro_config.ts';

const BUILD_CACHE_METADATA_FILENAME = '.build-meta.json';
const BUILD_CACHE_VERSION = '1';

/**
 * Metadata stored in the build directory to track cache validity.
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
	 * Hash of the lock file (package-lock.json, pnpm-lock.yaml, or yarn.lock).
	 */
	lock_file_hash: string | null;
	/**
	 * Hash of config files that affect the build.
	 */
	config_files_hash: string;
	/**
	 * Hash of user's custom build_cache_config from gro.config.ts.
	 */
	build_cache_config_hash: string;
	/**
	 * Hash of build task arguments.
	 */
	build_args_hash: string;
	/**
	 * Timestamp when build completed.
	 */
	timestamp: string;
	/**
	 * Build output directory.
	 */
	build_dir: string;
	/**
	 * Hashes of critical build outputs for validation.
	 */
	output_hashes: Record<string, string>;
}

/**
 * Computes the cache key components for a build.
 * This determines whether a cached build can be reused.
 */
export const compute_build_cache_key = async (
	config: Gro_Config,
	args: Record<string, unknown>,
	log: Logger,
): Promise<{
	git_commit: string | null;
	lock_file_hash: string | null;
	config_files_hash: string;
	build_cache_config_hash: string;
	build_args_hash: string;
}> => {
	// 1. Git commit hash - most conservative check
	const git_commit = await git_current_commit_hash();
	if (!git_commit) {
		log.warn('Not in a git repository - build cache will use null git commit');
	}

	// 2. Lock file hash - detect dependency changes
	const lock_file_hash = await hash_lock_file();

	// 3. Config files hash - detect config changes
	const config_files_hash = await hash_config_files();

	// 4. Build cache config hash - user-defined custom inputs
	// IMPORTANT: We hash this value and never log/write the raw value (may contain secrets)
	const build_cache_config_hash = await hash_build_cache_config(config);

	// 5. Build args hash - different args = different build
	const build_args_hash = await to_hash(Buffer.from(JSON.stringify(args), 'utf-8'));

	return {
		git_commit,
		lock_file_hash,
		config_files_hash,
		build_cache_config_hash,
		build_args_hash,
	};
};

/**
 * Finds and hashes the lock file (package-lock.json, pnpm-lock.yaml, or yarn.lock).
 */
const hash_lock_file = async (): Promise<string | null> => {
	const lock_files = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'];

	for (const lock_file of lock_files) {
		if (existsSync(lock_file)) {
			const contents = readFileSync(lock_file);
			return await to_hash(contents);
		}
	}

	return null;
};

/**
 * Hashes critical config files that affect builds.
 */
const hash_config_files = async (): Promise<string> => {
	const config_files = ['svelte.config.js', 'gro.config.ts', 'vite.config.ts', 'vite.config.js'];
	const hashes: string[] = [];

	for (const config_file of config_files) {
		if (existsSync(config_file)) {
			const contents = readFileSync(config_file);
			const hash = await to_hash(contents);
			hashes.push(`${config_file}:${hash}`);
		}
	}

	// Hash the combined hashes
	return await to_hash(Buffer.from(hashes.join(','), 'utf-8'));
};

/**
 * Hashes the user's build_cache_config from gro.config.ts.
 * IMPORTANT: The raw config is never logged or written to disk, only the hash.
 */
const hash_build_cache_config = async (config: Gro_Config): Promise<string> => {
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
 * Loads build cache metadata from the build directory.
 */
export const load_build_cache_metadata = (build_dir: string): Build_Cache_Metadata | null => {
	const metadata_path = join(build_dir, BUILD_CACHE_METADATA_FILENAME);

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
 * Saves build cache metadata to the build directory.
 */
export const save_build_cache_metadata = (
	metadata: Build_Cache_Metadata,
	build_dir: string,
): void => {
	const metadata_path = join(build_dir, BUILD_CACHE_METADATA_FILENAME);
	writeFileSync(metadata_path, JSON.stringify(metadata, null, '\t'), 'utf-8');
};

/**
 * Validates that a cached build is still valid by hashing outputs.
 * This is comprehensive validation to catch manual tampering or corruption.
 */
export const validate_build_cache = async (
	metadata: Build_Cache_Metadata,
	build_dir: string,
): Promise<boolean> => {
	if (!existsSync(build_dir)) {
		return false;
	}

	// Verify all tracked output files still exist and match their hashes
	for (const [file_path, expected_hash] of Object.entries(metadata.output_hashes)) {
		const full_path = join(build_dir, file_path);

		if (!existsSync(full_path)) {
			return false;
		}

		// For files, verify hash matches
		const stat = statSync(full_path);
		if (stat.isFile()) {
			const contents = readFileSync(full_path);
			const actual_hash = await to_hash(contents);

			if (actual_hash !== expected_hash) {
				return false;
			}
		}
	}

	return true;
};

/**
 * Main function to check if the build cache is valid.
 * Returns true if the cached build can be used, false if a fresh build is needed.
 */
export const is_build_cache_valid = async (
	config: Gro_Config,
	args: Record<string, unknown>,
	build_dir: string,
	log: Logger,
): Promise<boolean> => {
	// Load existing metadata
	const metadata = load_build_cache_metadata(build_dir);
	if (!metadata) {
		log.debug('No build cache metadata found');
		return false;
	}

	// Compute current cache key
	const current = await compute_build_cache_key(config, args, log);

	// Check if any cache keys have changed
	if (metadata.git_commit !== current.git_commit) {
		log.debug('Build cache invalid: git commit changed');
		return false;
	}

	if (metadata.lock_file_hash !== current.lock_file_hash) {
		log.debug('Build cache invalid: lock file changed');
		return false;
	}

	if (metadata.config_files_hash !== current.config_files_hash) {
		log.debug('Build cache invalid: config files changed');
		return false;
	}

	if (metadata.build_cache_config_hash !== current.build_cache_config_hash) {
		log.debug('Build cache invalid: build_cache_config changed');
		return false;
	}

	if (metadata.build_args_hash !== current.build_args_hash) {
		log.debug('Build cache invalid: build args changed');
		return false;
	}

	// Comprehensive validation: verify output files
	const outputs_valid = await validate_build_cache(metadata, build_dir);
	if (!outputs_valid) {
		log.debug('Build cache invalid: output files missing or corrupted');
		return false;
	}

	log.info(st('green', 'Build cache valid'), st('dim', `(from ${metadata.timestamp})`));
	return true;
};

/**
 * Hashes critical files in the build output directory for validation.
 * Returns a map of relative file paths to their hashes.
 */
export const hash_build_outputs = async (
	build_dir: string,
	max_files = 100,
): Promise<Record<string, string>> => {
	const output_hashes: Record<string, string> = {};

	if (!existsSync(build_dir)) {
		return output_hashes;
	}

	// Recursively hash files
	const hash_directory = async (dir: string, relative_base = ''): Promise<void> => {
		if (Object.keys(output_hashes).length >= max_files) {
			return; // Limit to avoid hashing too many files
		}

		const entries = readdirSync(dir, {withFileTypes: true});

		for (const entry of entries) {
			if (Object.keys(output_hashes).length >= max_files) {
				break;
			}

			// Skip metadata file itself
			if (entry.name === BUILD_CACHE_METADATA_FILENAME) {
				continue;
			}

			const full_path = join(dir, entry.name);
			const relative_path = relative_base ? join(relative_base, entry.name) : entry.name;

			if (entry.isDirectory()) {
				await hash_directory(full_path, relative_path);
			} else if (entry.isFile()) {
				const contents = readFileSync(full_path);
				const hash = await to_hash(contents);
				output_hashes[relative_path] = hash;
			}
		}
	};

	await hash_directory(build_dir);
	return output_hashes;
};

/**
 * Creates build cache metadata after a successful build.
 */
export const create_build_cache_metadata = async (
	config: Gro_Config,
	args: Record<string, unknown>,
	build_dir: string,
	log: Logger,
): Promise<Build_Cache_Metadata> => {
	const cache_key = await compute_build_cache_key(config, args, log);
	const output_hashes = await hash_build_outputs(build_dir);

	return {
		version: BUILD_CACHE_VERSION,
		...cache_key,
		timestamp: new Date().toISOString(),
		build_dir,
		output_hashes,
	};
};
