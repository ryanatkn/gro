import {vi} from 'vitest';
import type {Logger} from '@ryanatkn/belt/log.js';
import {json_stringify_deterministic} from '@ryanatkn/belt/json.js';

import type {Gro_Config} from '../lib/gro_config.ts';
import {to_hash} from '../lib/hash.ts';

/**
 * Creates a mock logger for testing.
 */
export const create_mock_logger = (): Logger =>
	({
		error: vi.fn(),
		warn: vi.fn(),
		info: vi.fn(),
		debug: vi.fn(),
		plain: vi.fn(),
		newline: vi.fn(),
	}) as unknown as Logger;

/**
 * Creates a mock Gro config for testing.
 * Note: build_cache_config in overrides will be hashed during creation.
 */
export const create_mock_config = async (
	overrides: Partial<Gro_Config> & {build_cache_config?: Record<string, unknown> | (() => Record<string, unknown> | Promise<Record<string, unknown>>)} = {},
): Promise<Gro_Config> => {
	// Extract and hash build_cache_config if provided
	const {build_cache_config, ...rest} = overrides;
	let build_cache_config_hash: string;

	if (!build_cache_config) {
		build_cache_config_hash = await to_hash(new TextEncoder().encode(''));
	} else {
		// Resolve if it's a function
		const resolved =
			typeof build_cache_config === 'function' ? await build_cache_config() : build_cache_config;

		// Hash the JSON representation with deterministic key ordering
		build_cache_config_hash = await to_hash(
			new TextEncoder().encode(json_stringify_deterministic(resolved)),
		);
	}

	return {
		plugins: () => [],
		map_package_json: null,
		task_root_dirs: [],
		search_filters: [],
		js_cli: 'node',
		pm_cli: 'npm',
		build_cache_config_hash,
		...(rest as Partial<Gro_Config>),
	} as Gro_Config;
};

/**
 * Creates a mock fs.Stats object for a file.
 */
export const mock_file_stats = (
	size = 1024,
	options: {
		mtimeMs?: number;
		ctimeMs?: number;
		mode?: number;
	} = {},
): any => ({
	size,
	mtimeMs: options.mtimeMs ?? 1729512000000,
	ctimeMs: options.ctimeMs ?? 1729512000000,
	mode: options.mode ?? 33188,
	isDirectory: () => false,
});

/**
 * Creates a mock fs.Stats object for a directory.
 */
export const mock_dir_stats = (): any => ({
	isDirectory: () => true,
});

/**
 * Creates a mock fs.Dirent object for a file.
 */
export const mock_file_entry = (name: string): any => ({
	name,
	isDirectory: () => false,
	isFile: () => true,
});

/**
 * Creates a mock fs.Dirent object for a directory.
 */
export const mock_dir_entry = (name: string): any => ({
	name,
	isDirectory: () => true,
	isFile: () => false,
});
