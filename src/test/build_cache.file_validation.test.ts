import {describe, test, expect, vi, beforeEach} from 'vitest';

import {validate_build_cache} from '../lib/build_cache.ts';

import {
	create_mock_build_cache_metadata,
	create_mock_output_entry,
} from './build_cache_test_helpers.ts';

// Mock file_snapshot from fuz_util (validate_build_cache now delegates to validate_file_snapshot)
vi.mock('@fuzdev/fuz_util/file_snapshot.js', () => ({
	collect_file_snapshot: vi.fn(),
	validate_file_snapshot: vi.fn(),
}));

describe('validate_build_cache', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('returns true when validate_file_snapshot returns true', async () => {
		const {validate_file_snapshot} = vi.mocked(await import('@fuzdev/fuz_util/file_snapshot.js'));

		const metadata = create_mock_build_cache_metadata({
			outputs: [
				create_mock_output_entry('build/index.html', {hash: 'hash1', size: 1024}),
				create_mock_output_entry('build/bundle.js', {hash: 'hash2', size: 2048}),
			],
		});

		vi.mocked(validate_file_snapshot).mockResolvedValue(true);

		const result = await validate_build_cache(metadata);

		expect(result).toBe(true);
	});

	test('returns false when validate_file_snapshot returns false', async () => {
		const {validate_file_snapshot} = vi.mocked(await import('@fuzdev/fuz_util/file_snapshot.js'));

		const metadata = create_mock_build_cache_metadata({
			outputs: [create_mock_output_entry('build/index.html')],
		});

		vi.mocked(validate_file_snapshot).mockResolvedValue(false);

		const result = await validate_build_cache(metadata);

		expect(result).toBe(false);
	});

	test('passes metadata outputs and concurrency to validate_file_snapshot', async () => {
		const {validate_file_snapshot} = vi.mocked(await import('@fuzdev/fuz_util/file_snapshot.js'));

		const outputs = [
			create_mock_output_entry('build/index.html', {hash: 'hash1'}),
			create_mock_output_entry('build/bundle.js', {hash: 'hash2', size: 2048}),
			create_mock_output_entry('build/styles.css', {hash: 'hash3', size: 512}),
		];

		const metadata = create_mock_build_cache_metadata({outputs});

		vi.mocked(validate_file_snapshot).mockResolvedValue(true);

		await validate_build_cache(metadata);

		expect(validate_file_snapshot).toHaveBeenCalledWith({
			entries: outputs,
			concurrency: 20,
		});
	});

	test('returns false for empty outputs when validate_file_snapshot returns false', async () => {
		const {validate_file_snapshot} = vi.mocked(await import('@fuzdev/fuz_util/file_snapshot.js'));

		const metadata = create_mock_build_cache_metadata({outputs: []});

		vi.mocked(validate_file_snapshot).mockResolvedValue(false);

		const result = await validate_build_cache(metadata);

		expect(result).toBe(false);
	});

	test('delegates validation entirely to validate_file_snapshot', async () => {
		const {validate_file_snapshot} = vi.mocked(await import('@fuzdev/fuz_util/file_snapshot.js'));

		const metadata = create_mock_build_cache_metadata({
			outputs: [
				create_mock_output_entry('build/file1.js', {hash: 'correct_hash'}),
				create_mock_output_entry('build/file2.js', {hash: 'correct_hash'}),
				create_mock_output_entry('build/file3.js', {hash: 'correct_hash'}),
			],
		});

		// validate_file_snapshot handles all the internal logic (size check, hash check, etc.)
		vi.mocked(validate_file_snapshot).mockResolvedValue(false);

		const result = await validate_build_cache(metadata);

		expect(result).toBe(false);
		expect(validate_file_snapshot).toHaveBeenCalledTimes(1);
	});

	test('returns true for single file when validate_file_snapshot succeeds', async () => {
		const {validate_file_snapshot} = vi.mocked(await import('@fuzdev/fuz_util/file_snapshot.js'));

		const metadata = create_mock_build_cache_metadata({
			outputs: [create_mock_output_entry('build/index.html', {size: 1024})],
		});

		vi.mocked(validate_file_snapshot).mockResolvedValue(true);

		const result = await validate_build_cache(metadata);

		expect(result).toBe(true);
	});

	test('returns false for multiple files when validate_file_snapshot fails', async () => {
		const {validate_file_snapshot} = vi.mocked(await import('@fuzdev/fuz_util/file_snapshot.js'));

		const metadata = create_mock_build_cache_metadata({
			outputs: [
				create_mock_output_entry('build/index.html', {hash: 'hash1', size: 1024}),
				create_mock_output_entry('build/bundle.js', {hash: 'hash2', size: 2048}),
			],
		});

		vi.mocked(validate_file_snapshot).mockResolvedValue(false);

		const result = await validate_build_cache(metadata);

		expect(result).toBe(false);
	});
});
