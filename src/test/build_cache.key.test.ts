import {describe, test, expect, vi, beforeEach} from 'vitest';
import {json_stringify_deterministic} from '@ryanatkn/belt/json.js';

import {compute_build_cache_key} from '../lib/build_cache.ts';

import {create_mock_logger, create_mock_config} from './build_cache_test_helpers.ts';

/* eslint-disable @typescript-eslint/require-await */

// Mock dependencies
vi.mock('@ryanatkn/belt/git.js', () => ({
	git_current_commit_hash: vi.fn(),
}));

vi.mock('$lib/hash.js', () => ({
	to_hash: vi.fn(),
}));

describe('compute_build_cache_key', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('returns consistent hash components for same inputs', async () => {
		const {git_current_commit_hash} = await import('@ryanatkn/belt/git.js');
		const {to_hash} = await import('$lib/hash.js');

		vi.mocked(git_current_commit_hash).mockResolvedValue('abc123');
		vi.mocked(to_hash).mockResolvedValue('hash123');

		const config = create_mock_config();
		const log = create_mock_logger();

		const result1 = await compute_build_cache_key(config, log);
		const result2 = await compute_build_cache_key(config, log);

		expect(result1).toEqual(result2);
		expect(result1.git_commit).toBe('abc123');
		expect(result1.build_cache_config_hash).toBe('hash123');
	});

	test('handles missing git repository', async () => {
		const {git_current_commit_hash} = await import('@ryanatkn/belt/git.js');
		const {to_hash} = await import('$lib/hash.js');

		vi.mocked(git_current_commit_hash).mockResolvedValue(null);
		vi.mocked(to_hash).mockResolvedValue('hash123');

		const config = create_mock_config();
		const log = create_mock_logger();

		const result = await compute_build_cache_key(config, log);

		expect(result.git_commit).toBeNull();
		expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('Not in a git repository'));
	});

	test('hashes build_cache_config when provided', async () => {
		const {git_current_commit_hash} = await import('@ryanatkn/belt/git.js');
		const {to_hash} = await import('$lib/hash.js');

		vi.mocked(git_current_commit_hash).mockResolvedValue('abc123');
		vi.mocked(to_hash).mockResolvedValue('custom_hash');

		const config = create_mock_config({
			build_cache_config: {api_url: 'https://example.com'},
		});
		const log = create_mock_logger();

		const result = await compute_build_cache_key(config, log);

		expect(result.build_cache_config_hash).toBeTruthy();
		expect(to_hash).toHaveBeenCalledWith(
			new TextEncoder().encode(json_stringify_deterministic({api_url: 'https://example.com'})),
		);
	});

	test('produces same hash for build_cache_config regardless of key order', async () => {
		const {git_current_commit_hash} = await import('@ryanatkn/belt/git.js');
		const {hash_build_cache_config} = await import('$lib/build_cache.js');

		vi.mocked(git_current_commit_hash).mockResolvedValue('abc123');

		const config1 = create_mock_config({
			build_cache_config: {z_key: 'value_z', a_key: 'value_a', m_key: 'value_m'},
		});
		const config2 = create_mock_config({
			build_cache_config: {a_key: 'value_a', m_key: 'value_m', z_key: 'value_z'},
		});
		const config3 = create_mock_config({
			build_cache_config: {m_key: 'value_m', z_key: 'value_z', a_key: 'value_a'},
		});

		const hash1 = await hash_build_cache_config(config1);
		const hash2 = await hash_build_cache_config(config2);
		const hash3 = await hash_build_cache_config(config3);

		expect(hash1).toBe(hash2);
		expect(hash2).toBe(hash3);
	});

	test('handles async build_cache_config function', async () => {
		const {git_current_commit_hash} = await import('@ryanatkn/belt/git.js');
		const {to_hash} = await import('$lib/hash.js');

		vi.mocked(git_current_commit_hash).mockResolvedValue('abc123');
		vi.mocked(to_hash).mockResolvedValue('hash123');

		const config = create_mock_config({
			build_cache_config: async () => ({feature_flag: true}),
		});
		const log = create_mock_logger();

		const result = await compute_build_cache_key(config, log);

		expect(result.build_cache_config_hash).toBeTruthy();
	});

	test('handles async build_cache_config function that throws', async () => {
		const {git_current_commit_hash} = await import('@ryanatkn/belt/git.js');

		vi.mocked(git_current_commit_hash).mockResolvedValue('abc123');

		const config = create_mock_config({
			build_cache_config: async () => {
				throw new Error('Failed to fetch remote config');
			},
		});
		const log = create_mock_logger();

		// Should throw the error from the async function
		await expect(compute_build_cache_key(config, log)).rejects.toThrow(
			'Failed to fetch remote config',
		);
	});

	test('handles build_cache_config with circular references', async () => {
		const {git_current_commit_hash} = await import('@ryanatkn/belt/git.js');

		vi.mocked(git_current_commit_hash).mockResolvedValue('abc123');

		// Create circular reference
		const circular: any = {foo: 'bar'};
		circular.self = circular;

		const config = create_mock_config({
			build_cache_config: circular,
		});
		const log = create_mock_logger();

		// Should throw when trying to JSON.stringify circular reference
		await expect(compute_build_cache_key(config, log)).rejects.toThrow();
	});

	test('handles build_cache_config with non-serializable values', async () => {
		const {git_current_commit_hash} = await import('@ryanatkn/belt/git.js');

		vi.mocked(git_current_commit_hash).mockResolvedValue('abc123');

		const config = create_mock_config({
			build_cache_config: {
				func: () => 'not serializable',
				symbol: Symbol('test'),
			},
		});
		const log = create_mock_logger();

		// JSON.stringify should handle these by omitting them, so no error
		// but the hash should be based on the serializable portion
		const result = await compute_build_cache_key(config, log);

		expect(result.build_cache_config_hash).toBeTruthy();
	});
});
