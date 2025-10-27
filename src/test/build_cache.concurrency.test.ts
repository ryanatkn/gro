import {describe, test, expect, vi, beforeEach} from 'vitest';

import {is_build_cache_valid, save_build_cache_metadata} from '../lib/build_cache.ts';

import {
	create_mock_logger,
	create_mock_config,
	create_mock_build_cache_metadata,
} from './build_cache_test_helpers.ts';

// Mock dependencies
vi.mock('@ryanatkn/belt/git.js', () => ({
	git_current_commit_hash: vi.fn(),
}));

vi.mock('$lib/paths.js', () => ({
	paths: {
		root: './',
		source: './src/',
		lib: './src/lib/',
		build: './.gro/',
		build_dev: './.gro/dev/',
		config: './gro.config.ts',
	},
}));

vi.mock('node:fs', () => ({
	existsSync: vi.fn(),
	readFileSync: vi.fn(),
	writeFileSync: vi.fn(),
	mkdirSync: vi.fn(),
	rmSync: vi.fn(),
	statSync: vi.fn(),
	readdirSync: vi.fn(),
}));

vi.mock('$lib/hash.js', () => ({
	to_hash: vi.fn(),
}));

describe('race condition: cache file modification during validation', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('handles cache file being modified while reading', async () => {
		const {existsSync, readFileSync} = await import('node:fs');
		const {git_current_commit_hash} = await import('@ryanatkn/belt/git.js');
		const {to_hash} = await import('$lib/hash.js');

		const initial_metadata = create_mock_build_cache_metadata({git_commit: 'abc123'});
		const modified_metadata = create_mock_build_cache_metadata({git_commit: 'def456'});

		// Simulate cache file being modified during validation
		let read_count = 0;
		vi.mocked(readFileSync).mockImplementation(() => {
			read_count++;
			// First read gets initial metadata, second read (during validation) gets modified
			return JSON.stringify(read_count === 1 ? initial_metadata : modified_metadata);
		});

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(git_current_commit_hash).mockResolvedValue('abc123');
		vi.mocked(to_hash).mockResolvedValue('hash123');

		const config = await create_mock_config();
		const log = create_mock_logger();

		// This represents a very unlikely race condition, but system should handle gracefully
		const result = await is_build_cache_valid(config, log);

		// Cache validation should happen with the initially loaded metadata
		// The result depends on when the validation happens vs when file is modified
		expect(typeof result).toBe('boolean');
	});

	test('handles concurrent cache writes', async () => {
		const {writeFileSync, mkdirSync} = await import('node:fs');

		const metadata1 = create_mock_build_cache_metadata({git_commit: 'commit1'});
		const metadata2 = create_mock_build_cache_metadata({git_commit: 'commit2'});

		let write_count = 0;
		vi.mocked(writeFileSync).mockImplementation(() => {
			write_count++;
			// Simulate concurrent writes - not expected in practice but should not crash
		});

		// Try to save two different cache states
		save_build_cache_metadata(metadata1);
		save_build_cache_metadata(metadata2);

		// Both should complete without throwing
		expect(write_count).toBe(2);
		expect(mkdirSync).toHaveBeenCalledTimes(2);
	});

	test('handles multiple concurrent build validation operations', async () => {
		const {existsSync, readFileSync} = await import('node:fs');
		const {git_current_commit_hash} = await import('@ryanatkn/belt/git.js');
		const {to_hash} = await import('$lib/hash.js');

		const metadata = create_mock_build_cache_metadata({git_commit: 'abc123'});

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readFileSync).mockReturnValue(JSON.stringify(metadata));
		vi.mocked(git_current_commit_hash).mockResolvedValue('abc123');
		vi.mocked(to_hash).mockResolvedValue('hash123');

		const config = await create_mock_config();
		const log = create_mock_logger();

		// Simulate multiple concurrent cache validation operations
		// In practice this shouldn't happen, but system should handle gracefully
		const validations = await Promise.all([
			is_build_cache_valid(config, log),
			is_build_cache_valid(config, log),
			is_build_cache_valid(config, log),
		]);

		// All validations should complete without throwing
		expect(validations).toHaveLength(3);
		validations.forEach((result) => {
			expect(typeof result).toBe('boolean');
		});
	});

	// Note: Git commit changing during build is tested at the integration level
	// in build.task.test.ts, where the task verifies commit hash before/after build
	// and prevents cache save if changed (build.task.ts:122-132)
});
