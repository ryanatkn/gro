import {describe, test, expect} from 'vitest';

import {Build_Cache_Metadata} from '../lib/build_cache.ts';

describe('Build_Cache_Metadata schema', () => {
	test('validates correct metadata structure', () => {
		expect(() =>
			Build_Cache_Metadata.parse({
				version: '1',
				git_commit: 'abc123',
				build_cache_config_hash: 'hash',
				timestamp: '2025-10-23T12:00:00Z',
				outputs: [
					{
						path: 'file.js',
						hash: 'hash',
						size: 1024,
						mtime: 1729512000000,
						ctime: 1729512000000,
						mode: 33188,
					},
				],
			}),
		).not.toThrow();
	});

	test('rejects metadata with missing fields', () => {
		expect(() =>
			Build_Cache_Metadata.parse({
				version: '1',
				git_commit: 'abc123',
				// missing build_cache_config_hash
				timestamp: '2025-10-23T12:00:00Z',
				outputs: [],
			}),
		).toThrow();
	});

	test('rejects metadata with wrong types', () => {
		expect(() =>
			Build_Cache_Metadata.parse({
				version: 1, // should be string
				git_commit: 'abc123',
				build_cache_config_hash: 'hash',
				timestamp: '2025-10-23T12:00:00Z',
				outputs: [],
			}),
		).toThrow();
	});

	test('rejects metadata with unexpected extra fields', () => {
		expect(() =>
			Build_Cache_Metadata.parse({
				version: '1',
				git_commit: 'abc',
				build_cache_config_hash: 'hash',
				timestamp: '2025-10-23T12:00:00Z',
				outputs: [],
				unexpected_field: 'bad',
			}),
		).toThrow();
	});
});
