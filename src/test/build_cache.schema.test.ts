import {describe, test, expect} from 'vitest';

import {Build_Cache_Metadata} from '../lib/build_cache.ts';

import {create_mock_build_cache_metadata, create_mock_output_entry} from './build_cache_test_helpers.ts';

describe('Build_Cache_Metadata schema', () => {
	test('validates correct metadata structure', () => {
		const metadata = create_mock_build_cache_metadata({
			outputs: [create_mock_output_entry('file.js')],
		});
		expect(() => Build_Cache_Metadata.parse(metadata)).not.toThrow();
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
