import {describe, test, expect, vi, beforeEach} from 'vitest';

import {validate_build_cache} from '../lib/build_cache.ts';

import {create_mock_build_cache_metadata} from './build_cache_test_helpers.ts';

// Mock dependencies
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

describe('validate_build_cache', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('returns true when all output files match hashes and sizes', async () => {
		const {existsSync, readFileSync, statSync} = await import('node:fs');
		const {to_hash} = await import('$lib/hash.js');

		const metadata = create_mock_build_cache_metadata({
			outputs: [
				{
					path: 'build/index.html',
					hash: 'hash1',
					size: 1024,
					mtime: 1729512000000,
					ctime: 1729512000000,
					mode: 33188,
				},
				{
					path: 'build/bundle.js',
					hash: 'hash2',
					size: 2048,
					mtime: 1729512001000,
					ctime: 1729512001000,
					mode: 33188,
				},
			],
		});

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(statSync).mockImplementation((path: any) => {
			if (String(path) === 'build/index.html') {
				return {size: 1024} as any;
			}
			return {size: 2048} as any;
		});
		vi.mocked(readFileSync).mockReturnValue(Buffer.from('content'));

		let call_count = 0;
		// eslint-disable-next-line @typescript-eslint/require-await
		vi.mocked(to_hash).mockImplementation(async () => {
			call_count++;
			return call_count === 1 ? 'hash1' : 'hash2';
		});

		const result = await validate_build_cache(metadata);

		expect(result).toBe(true);
	});

	test('returns false when output file is missing', async () => {
		const {existsSync} = await import('node:fs');

		const metadata = create_mock_build_cache_metadata({
			outputs: [
				{
					path: 'build/index.html',
					hash: 'hash1',
					size: 1024,
					mtime: 1729512000000,
					ctime: 1729512000000,
					mode: 33188,
				},
			],
		});

		vi.mocked(existsSync).mockReturnValue(false);

		const result = await validate_build_cache(metadata);

		expect(result).toBe(false);
	});

	test('returns false when output file size differs (fast path)', async () => {
		const {existsSync, statSync} = await import('node:fs');

		const metadata = create_mock_build_cache_metadata({
			outputs: [
				{
					path: 'build/index.html',
					hash: 'expected_hash',
					size: 1024,
					mtime: 1729512000000,
					ctime: 1729512000000,
					mode: 33188,
				},
			],
		});

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(statSync).mockReturnValue({size: 2048} as any); // Different size

		const result = await validate_build_cache(metadata);

		expect(result).toBe(false);
	});

	test('returns false when output file hash does not match', async () => {
		const {existsSync, readFileSync, statSync} = await import('node:fs');
		const {to_hash} = await import('$lib/hash.js');

		const metadata = create_mock_build_cache_metadata({
			outputs: [
				{
					path: 'build/index.html',
					hash: 'expected_hash',
					size: 1024,
					mtime: 1729512000000,
					ctime: 1729512000000,
					mode: 33188,
				},
			],
		});

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(statSync).mockReturnValue({size: 1024} as any); // Size matches
		vi.mocked(readFileSync).mockReturnValue(Buffer.from('content'));
		vi.mocked(to_hash).mockResolvedValue('different_hash'); // Hash differs

		const result = await validate_build_cache(metadata);

		expect(result).toBe(false);
	});

	test('returns false when some files exist but others are missing', async () => {
		const {existsSync} = await import('node:fs');

		const metadata = create_mock_build_cache_metadata({
			outputs: [
				{
					path: 'build/index.html',
					hash: 'hash1',
					size: 1024,
					mtime: 1729512000000,
					ctime: 1729512000000,
					mode: 33188,
				},
				{
					path: 'build/missing.js',
					hash: 'hash2',
					size: 2048,
					mtime: 1729512001000,
					ctime: 1729512001000,
					mode: 33188,
				},
				{
					path: 'build/another.css',
					hash: 'hash3',
					size: 512,
					mtime: 1729512002000,
					ctime: 1729512002000,
					mode: 33188,
				},
			],
		});

		// Only first file exists
		vi.mocked(existsSync).mockImplementation((path: any) => {
			return String(path) === 'build/index.html';
		});

		const result = await validate_build_cache(metadata);

		expect(result).toBe(false);
	});

	test('returns false when parallel hash validation has mixed results', async () => {
		const {existsSync, readFileSync, statSync} = await import('node:fs');
		const {to_hash} = await import('$lib/hash.js');

		const metadata = create_mock_build_cache_metadata({
			outputs: [
				{
					path: 'build/file1.js',
					hash: 'correct_hash',
					size: 1024,
					mtime: 1729512000000,
					ctime: 1729512000000,
					mode: 33188,
				},
				{
					path: 'build/file2.js',
					hash: 'correct_hash',
					size: 1024,
					mtime: 1729512001000,
					ctime: 1729512001000,
					mode: 33188,
				},
				{
					path: 'build/file3.js',
					hash: 'correct_hash',
					size: 1024,
					mtime: 1729512002000,
					ctime: 1729512002000,
					mode: 33188,
				},
			],
		});

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(statSync).mockReturnValue({size: 1024} as any); // All sizes match
		vi.mocked(readFileSync).mockReturnValue(Buffer.from('content'));

		// Simulate: first two files match, third doesn't
		let call_count = 0;
		// eslint-disable-next-line @typescript-eslint/require-await
		vi.mocked(to_hash).mockImplementation(async () => {
			call_count++;
			return call_count <= 2 ? 'correct_hash' : 'wrong_hash';
		});

		const result = await validate_build_cache(metadata);

		// Should return false because not ALL files match
		expect(result).toBe(false);
	});

	test('returns false when file is deleted between size check and hash validation', async () => {
		const {existsSync, readFileSync, statSync} = await import('node:fs');

		const metadata = create_mock_build_cache_metadata({
			outputs: [
				{
					path: 'build/index.html',
					hash: 'expected_hash',
					size: 1024,
					mtime: 1729512000000,
					ctime: 1729512000000,
					mode: 33188,
				},
			],
		});

		// File exists and size matches during initial checks
		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(statSync).mockReturnValue({size: 1024} as any);

		// But file is deleted/inaccessible during hash validation
		vi.mocked(readFileSync).mockImplementation(() => {
			throw new Error('ENOENT: no such file or directory');
		});

		const result = await validate_build_cache(metadata);

		// Should return false gracefully (not throw)
		expect(result).toBe(false);
	});

	test('returns false when file becomes inaccessible during hash validation', async () => {
		const {existsSync, readFileSync, statSync} = await import('node:fs');

		const metadata = create_mock_build_cache_metadata({
			outputs: [
				{
					path: 'build/index.html',
					hash: 'hash1',
					size: 1024,
					mtime: 1729512000000,
					ctime: 1729512000000,
					mode: 33188,
				},
				{
					path: 'build/bundle.js',
					hash: 'hash2',
					size: 2048,
					mtime: 1729512001000,
					ctime: 1729512001000,
					mode: 33188,
				},
			],
		});

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(statSync).mockImplementation((path: any) => {
			if (String(path) === 'build/index.html') {
				return {size: 1024} as any;
			}
			return {size: 2048} as any;
		});

		// Second file throws permission error during hash validation
		vi.mocked(readFileSync).mockImplementation((path: any) => {
			if (String(path) === 'build/index.html') {
				return Buffer.from('content');
			}
			throw new Error('EACCES: permission denied');
		});

		const result = await validate_build_cache(metadata);

		// Should return false gracefully (not throw)
		expect(result).toBe(false);
	});
});
