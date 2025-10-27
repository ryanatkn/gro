import {describe, test, expect, vi, beforeEach} from 'vitest';
import type {Logger} from '@ryanatkn/belt/log.js';
import {json_stringify_deterministic} from '@ryanatkn/belt/json.js';

import {
	compute_build_cache_key,
	load_build_cache_metadata,
	save_build_cache_metadata,
	validate_build_cache,
	is_build_cache_valid,
	collect_build_outputs,
	create_build_cache_metadata,
	discover_build_output_dirs,
	Build_Cache_Metadata,
} from './build_cache.ts';
import type {Gro_Config} from './gro_config.ts';

/* eslint-disable @typescript-eslint/require-await */

// Mock dependencies
vi.mock('@ryanatkn/belt/git.js', () => ({
	git_current_commit_hash: vi.fn(),
}));

vi.mock('./paths.ts', () => ({
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

vi.mock('./hash.ts', () => ({
	to_hash: vi.fn(),
}));

// Helper to create mock logger
const create_mock_logger = (): Logger =>
	({
		error: vi.fn(),
		warn: vi.fn(),
		info: vi.fn(),
		debug: vi.fn(),
		plain: vi.fn(),
		newline: vi.fn(),
	}) as unknown as Logger;

// Helper to create mock config
const create_mock_config = (overrides: Partial<Gro_Config> = {}): Gro_Config =>
	({
		plugins: () => [],
		map_package_json: null,
		task_root_dirs: [],
		search_filters: [],
		js_cli: 'node',
		pm_cli: 'npm',
		build_cache_config: undefined,
		...overrides,
	}) as Gro_Config;

// Helper to create mock metadata
const create_mock_metadata = (
	overrides: Partial<Build_Cache_Metadata> = {},
): Build_Cache_Metadata => ({
	version: '1',
	git_commit: 'abc123',
	build_cache_config_hash: 'jkl012',
	timestamp: '2025-10-21T10:00:00.000Z',
	outputs: [],
	...overrides,
});

describe('compute_build_cache_key', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('returns consistent hash components for same inputs', async () => {
		const {git_current_commit_hash} = await import('@ryanatkn/belt/git.js');
		const {to_hash} = await import('./hash.ts');

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
		const {to_hash} = await import('./hash.ts');

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
		const {to_hash} = await import('./hash.ts');

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
		const {hash_build_cache_config} = await import('./build_cache.ts');

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
		const {to_hash} = await import('./hash.ts');

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

describe('load_build_cache_metadata', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('loads valid metadata file', async () => {
		const {existsSync, readFileSync} = await import('node:fs');

		const metadata = create_mock_metadata();
		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readFileSync).mockReturnValue(JSON.stringify(metadata));

		const result = load_build_cache_metadata();

		expect(result).toEqual(metadata);
	});

	test('returns null for non-existent file', async () => {
		const {existsSync} = await import('node:fs');

		vi.mocked(existsSync).mockReturnValue(false);

		const result = load_build_cache_metadata();

		expect(result).toBeNull();
	});

	test('returns null for invalid JSON', async () => {
		const {existsSync, readFileSync} = await import('node:fs');

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readFileSync).mockReturnValue('invalid json{');

		const result = load_build_cache_metadata();

		expect(result).toBeNull();
	});

	test('returns null for wrong schema version', async () => {
		const {existsSync, readFileSync} = await import('node:fs');

		const metadata = create_mock_metadata({version: '999'});
		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readFileSync).mockReturnValue(JSON.stringify(metadata));

		const result = load_build_cache_metadata();

		expect(result).toBeNull();
	});

	test('deletes cache file on schema version mismatch', async () => {
		const {existsSync, readFileSync, rmSync} = await import('node:fs');

		const metadata = create_mock_metadata({version: '999'});
		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readFileSync).mockReturnValue(JSON.stringify(metadata));

		load_build_cache_metadata();

		expect(rmSync).toHaveBeenCalledWith('.gro/build.json', {force: true});
	});

	test('deletes cache file on corrupted JSON', async () => {
		const {existsSync, readFileSync, rmSync} = await import('node:fs');

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readFileSync).mockReturnValue('invalid json{');

		load_build_cache_metadata();

		expect(rmSync).toHaveBeenCalledWith('.gro/build.json', {force: true});
	});

	test('handles cleanup errors gracefully', async () => {
		const {existsSync, readFileSync, rmSync} = await import('node:fs');

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readFileSync).mockReturnValue('invalid json{');
		vi.mocked(rmSync).mockImplementation(() => {
			throw new Error('Permission denied');
		});

		// Should not throw despite cleanup error
		expect(() => load_build_cache_metadata()).not.toThrow();
		expect(load_build_cache_metadata()).toBeNull();
	});

	test('returns null for empty file', async () => {
		const {existsSync, readFileSync} = await import('node:fs');

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readFileSync).mockReturnValue('');

		const result = load_build_cache_metadata();

		expect(result).toBeNull();
	});

	test('returns null for valid JSON with wrong version', async () => {
		const {existsSync, readFileSync} = await import('node:fs');

		// Valid JSON but has wrong version field
		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readFileSync).mockReturnValue(
			JSON.stringify({version: 'wrong', git_commit: 'abc', build_cache_config_hash: 'hash'}),
		);

		const result = load_build_cache_metadata();

		// Should return null due to version mismatch (validated during loading)
		expect(result).toBeNull();
	});

	test('returns null for truncated JSON file', async () => {
		const {existsSync, readFileSync} = await import('node:fs');

		// Simulate truncated write (incomplete JSON)
		const truncated = '{"version":"1","git_commit":"abc123","build_cache_config_hash":"hash","tim';

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readFileSync).mockReturnValue(truncated);

		const result = load_build_cache_metadata();

		expect(result).toBeNull();
	});

	test('rejects cache with missing required fields (Zod validation)', async () => {
		const {existsSync, readFileSync} = await import('node:fs');

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readFileSync).mockReturnValue(
			JSON.stringify({
				version: '1',
				git_commit: 'abc123',
				// missing build_cache_config_hash
				timestamp: '2025-10-23T12:00:00Z',
				outputs: [],
			}),
		);

		const result = load_build_cache_metadata();

		expect(result).toBeNull();
	});

	test('rejects cache with wrong field types (Zod validation)', async () => {
		const {existsSync, readFileSync} = await import('node:fs');

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readFileSync).mockReturnValue(
			JSON.stringify({
				version: 1, // should be string
				git_commit: 'abc123',
				build_cache_config_hash: 'hash',
				timestamp: '2025-10-23T12:00:00Z',
				outputs: [],
			}),
		);

		const result = load_build_cache_metadata();

		expect(result).toBeNull();
	});

	test('rejects cache with unexpected extra fields (strictObject)', async () => {
		const {existsSync, readFileSync} = await import('node:fs');

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readFileSync).mockReturnValue(
			JSON.stringify({
				version: '1',
				git_commit: 'abc',
				build_cache_config_hash: 'hash',
				timestamp: '2025-10-23T12:00:00Z',
				outputs: [],
				unexpected_field: 'bad',
			}),
		);

		const result = load_build_cache_metadata();

		expect(result).toBeNull();
	});

	test('rejects cache with invalid outputs type', async () => {
		const {existsSync, readFileSync} = await import('node:fs');

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readFileSync).mockReturnValue(
			JSON.stringify({
				version: '1',
				git_commit: 'abc',
				build_cache_config_hash: 'hash',
				timestamp: '2025-10-23T12:00:00Z',
				outputs: 'not-an-array', // should be Array<Build_Output_Entry>
			}),
		);

		const result = load_build_cache_metadata();

		expect(result).toBeNull();
	});
});

describe('save_build_cache_metadata', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('writes metadata to correct path', async () => {
		const {writeFileSync, mkdirSync} = await import('node:fs');

		const metadata = create_mock_metadata();

		save_build_cache_metadata(metadata);

		expect(mkdirSync).toHaveBeenCalledWith('./.gro/', {recursive: true});
		expect(writeFileSync).toHaveBeenCalledWith('.gro/build.json', expect.any(String), 'utf-8');
	});

	test('uses proper JSON formatting with tabs', async () => {
		const {writeFileSync} = await import('node:fs');

		const metadata = create_mock_metadata();

		save_build_cache_metadata(metadata);

		const written_content = vi.mocked(writeFileSync).mock.calls[0][1] as string;
		expect(written_content).toContain('\t');
		expect(JSON.parse(written_content)).toEqual(metadata);
	});

	test('logs warning on write error', async () => {
		const {writeFileSync} = await import('node:fs');

		const metadata = create_mock_metadata();
		const log = create_mock_logger();

		vi.mocked(writeFileSync).mockImplementation(() => {
			throw new Error('ENOSPC: no space left on device');
		});

		save_build_cache_metadata(metadata, log);

		expect(log.warn).toHaveBeenCalledWith(
			expect.stringContaining('Failed to save build cache'),
			expect.stringContaining('no space left on device'),
		);
	});

	test('does not throw on write error', async () => {
		const {writeFileSync} = await import('node:fs');

		const metadata = create_mock_metadata();

		vi.mocked(writeFileSync).mockImplementation(() => {
			throw new Error('EACCES: permission denied');
		});

		// Should not throw despite write error
		expect(() => save_build_cache_metadata(metadata)).not.toThrow();
	});

	test('handles write error without logger', async () => {
		const {writeFileSync} = await import('node:fs');

		const metadata = create_mock_metadata();

		vi.mocked(writeFileSync).mockImplementation(() => {
			throw new Error('Write failed');
		});

		// Should not throw even without logger (log?.warn is safe)
		expect(() => save_build_cache_metadata(metadata)).not.toThrow();
	});
});

describe('validate_build_cache', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('returns true when all output files match hashes and sizes', async () => {
		const {existsSync, readFileSync, statSync} = await import('node:fs');
		const {to_hash} = await import('./hash.ts');

		const metadata = create_mock_metadata({
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
		vi.mocked(to_hash).mockImplementation(async () => {
			call_count++;
			return call_count === 1 ? 'hash1' : 'hash2';
		});

		const result = await validate_build_cache(metadata);

		expect(result).toBe(true);
	});

	test('returns false when output file is missing', async () => {
		const {existsSync} = await import('node:fs');

		const metadata = create_mock_metadata({
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

		const metadata = create_mock_metadata({
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
		const {to_hash} = await import('./hash.ts');

		const metadata = create_mock_metadata({
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

		const metadata = create_mock_metadata({
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
		const {to_hash} = await import('./hash.ts');

		const metadata = create_mock_metadata({
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

		const metadata = create_mock_metadata({
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

		const metadata = create_mock_metadata({
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

describe('is_build_cache_valid', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('returns true when cache keys match and outputs valid', async () => {
		const {git_current_commit_hash} = await import('@ryanatkn/belt/git.js');
		const {existsSync, readFileSync} = await import('node:fs');
		const {to_hash} = await import('./hash.ts');

		const metadata = create_mock_metadata({
			git_commit: 'abc123',
			build_cache_config_hash: 'jkl012',
		});

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readFileSync).mockReturnValue(JSON.stringify(metadata));
		vi.mocked(git_current_commit_hash).mockResolvedValue('abc123');
		vi.mocked(to_hash).mockResolvedValue('jkl012');

		const config = create_mock_config();
		const log = create_mock_logger();

		const result = await is_build_cache_valid(config, log);

		expect(result).toBe(true);
		expect(log.info).toHaveBeenCalledWith(
			expect.stringContaining('Build cache valid'),
			expect.anything(),
		);
	});

	test('returns false when no metadata exists', async () => {
		const {existsSync} = await import('node:fs');

		vi.mocked(existsSync).mockReturnValue(false);

		const config = create_mock_config();
		const log = create_mock_logger();

		const result = await is_build_cache_valid(config, log);

		expect(result).toBe(false);
		expect(log.debug).toHaveBeenCalledWith('No build cache metadata found');
	});

	test('returns false when git commit differs', async () => {
		const {git_current_commit_hash} = await import('@ryanatkn/belt/git.js');
		const {existsSync, readFileSync} = await import('node:fs');

		const metadata = create_mock_metadata({git_commit: 'old_commit'});

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readFileSync).mockReturnValue(JSON.stringify(metadata));
		vi.mocked(git_current_commit_hash).mockResolvedValue('new_commit');

		const config = create_mock_config();
		const log = create_mock_logger();

		const result = await is_build_cache_valid(config, log);

		expect(result).toBe(false);
		expect(log.debug).toHaveBeenCalledWith('Build cache invalid: git commit changed');
	});

	test('returns false when build_cache_config hash differs', async () => {
		const {git_current_commit_hash} = await import('@ryanatkn/belt/git.js');
		const {existsSync, readFileSync} = await import('node:fs');
		const {to_hash} = await import('./hash.ts');

		const metadata = create_mock_metadata({
			git_commit: 'abc123',
			build_cache_config_hash: 'old_config_hash',
		});

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readFileSync).mockReturnValue(JSON.stringify(metadata));
		vi.mocked(git_current_commit_hash).mockResolvedValue('abc123');
		vi.mocked(to_hash).mockResolvedValue('new_config_hash');

		const config = create_mock_config({
			build_cache_config: {changed: true},
		});
		const log = create_mock_logger();

		const result = await is_build_cache_valid(config, log);

		expect(result).toBe(false);
		expect(log.debug).toHaveBeenCalledWith('Build cache invalid: build_cache_config changed');
	});
});

describe('discover_build_output_dirs', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('returns all existing build directories', async () => {
		const {existsSync, readdirSync, statSync} = await import('node:fs');

		// Mock all directories exist
		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readdirSync).mockReturnValue([
			'dist_server',
			'dist_worker',
			'node_modules',
			'src',
		] as any);
		vi.mocked(statSync).mockReturnValue({isDirectory: () => true} as any);

		const result = discover_build_output_dirs();

		expect(result).toEqual(['build', 'dist', 'dist_server', 'dist_worker']);
	});

	test('returns only directories that exist', async () => {
		const {existsSync, readdirSync, statSync} = await import('node:fs');

		// Only dist and dist_server exist
		vi.mocked(existsSync).mockImplementation((path: any) => {
			return path === 'dist';
		});
		vi.mocked(readdirSync).mockReturnValue(['dist_server', 'other'] as any);
		vi.mocked(statSync).mockReturnValue({isDirectory: () => true} as any);

		const result = discover_build_output_dirs();

		expect(result).toEqual(['dist', 'dist_server']);
	});

	test('returns empty array when no build directories exist', async () => {
		const {existsSync, readdirSync} = await import('node:fs');

		vi.mocked(existsSync).mockReturnValue(false);
		vi.mocked(readdirSync).mockReturnValue([] as any);

		const result = discover_build_output_dirs();

		expect(result).toEqual([]);
	});

	test('filters out non-directory dist_ entries', async () => {
		const {existsSync, readdirSync, statSync} = await import('node:fs');

		vi.mocked(existsSync).mockImplementation((path: any) => path === 'build');
		vi.mocked(readdirSync).mockReturnValue([
			'dist_server',
			'dist_readme.md', // file, not directory
		] as any);
		vi.mocked(statSync).mockImplementation((path: any) => {
			if (String(path) === 'dist_server') {
				return {isDirectory: () => true} as any;
			}
			return {isDirectory: () => false} as any;
		});

		const result = discover_build_output_dirs();

		expect(result).toEqual(['build', 'dist_server']);
		expect(result).not.toContain('dist_readme.md');
	});

	test('handles permission errors on directory listing', async () => {
		const {existsSync, readdirSync, statSync} = await import('node:fs');

		vi.mocked(existsSync).mockReturnValue(true);

		// readdirSync throws permission error
		vi.mocked(readdirSync).mockImplementation(() => {
			throw new Error('EACCES: permission denied');
		});
		vi.mocked(statSync).mockReturnValue({isDirectory: () => true} as any);

		// Should throw - permission errors are fatal
		expect(() => discover_build_output_dirs()).toThrow('EACCES: permission denied');
	});

	test('handles files named with dist_ prefix', async () => {
		const {existsSync, readdirSync, statSync} = await import('node:fs');

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readdirSync).mockReturnValue([
			'dist_config.json', // file, not directory
			'dist_server', // directory
		] as any);

		// Mock statSync to differentiate files vs directories
		vi.mocked(statSync).mockImplementation((path: any) => {
			if (String(path) === 'dist_server') {
				return {isDirectory: () => true} as any;
			}
			return {isDirectory: () => false} as any;
		});

		const result = discover_build_output_dirs();

		// Should include directory but not file
		expect(result).toContain('dist_server');
		expect(result).not.toContain('dist_config.json');
	});

	test('skips non-dist_ prefixed directories', async () => {
		const {existsSync, readdirSync, statSync} = await import('node:fs');

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readdirSync).mockReturnValue([
			'node_modules',
			'src',
			'dist_server', // should be included
			'output', // should not be included
		] as any);
		vi.mocked(statSync).mockReturnValue({isDirectory: () => true} as any);

		const result = discover_build_output_dirs();

		expect(result).toEqual(['build', 'dist', 'dist_server']);
		expect(result).not.toContain('node_modules');
		expect(result).not.toContain('src');
		expect(result).not.toContain('output');
	});
});

describe('collect_build_outputs', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('hashes all files in build directory', async () => {
		const {existsSync, readdirSync, readFileSync, statSync} = await import('node:fs');
		const {to_hash} = await import('./hash.ts');

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readdirSync).mockReturnValue([
			{name: 'index.html', isDirectory: () => false, isFile: () => true},
			{name: 'bundle.js', isDirectory: () => false, isFile: () => true},
		] as any);
		vi.mocked(statSync).mockReturnValue({
			size: 1024,
			mtimeMs: 1729512000000,
			ctimeMs: 1729512000000,
			mode: 33188,
		} as any);
		vi.mocked(readFileSync).mockReturnValue(Buffer.from('content'));

		let hash_count = 0;
		vi.mocked(to_hash).mockImplementation(async () => `hash${++hash_count}`);

		const result = await collect_build_outputs(['build']);

		expect(result).toHaveLength(2);
		expect(result[0]).toEqual({
			path: 'build/index.html',
			hash: 'hash1',
			size: 1024,
			mtime: 1729512000000,
			ctime: 1729512000000,
			mode: 33188,
		});
		expect(result[1]).toEqual({
			path: 'build/bundle.js',
			hash: 'hash2',
			size: 1024,
			mtime: 1729512000000,
			ctime: 1729512000000,
			mode: 33188,
		});
	});

	test('skips build.json file', async () => {
		const {existsSync, readdirSync, readFileSync, statSync} = await import('node:fs');
		const {to_hash} = await import('./hash.ts');

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readdirSync).mockReturnValue([
			{name: 'build.json', isDirectory: () => false, isFile: () => true},
			{name: 'index.html', isDirectory: () => false, isFile: () => true},
		] as any);
		vi.mocked(statSync).mockReturnValue({
			size: 1024,
			mtimeMs: 1729512000000,
			ctimeMs: 1729512000000,
			mode: 33188,
		} as any);
		vi.mocked(readFileSync).mockReturnValue(Buffer.from('content'));
		vi.mocked(to_hash).mockResolvedValue('hash');

		const result = await collect_build_outputs(['build']);

		expect(result).toHaveLength(1);
		expect(result.find((o) => o.path === 'build/build.json')).toBeUndefined();
		expect(result.find((o) => o.path === 'build/index.html')).toBeDefined();
	});

	test('returns empty array for non-existent directory', async () => {
		const {existsSync} = await import('node:fs');

		vi.mocked(existsSync).mockReturnValue(false);

		const result = await collect_build_outputs(['build']);

		expect(result).toEqual([]);
	});

	test('hashes all files in directory', async () => {
		const {existsSync, readdirSync, readFileSync, statSync} = await import('node:fs');
		const {to_hash} = await import('./hash.ts');

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readdirSync).mockReturnValue([
			{name: 'file1.js', isDirectory: () => false, isFile: () => true},
			{name: 'file2.js', isDirectory: () => false, isFile: () => true},
			{name: 'file3.js', isDirectory: () => false, isFile: () => true},
		] as any);
		vi.mocked(statSync).mockReturnValue({
			size: 1024,
			mtimeMs: 1729512000000,
			ctimeMs: 1729512000000,
			mode: 33188,
		} as any);
		vi.mocked(readFileSync).mockReturnValue(Buffer.from('content'));
		vi.mocked(to_hash).mockResolvedValue('hash');

		const result = await collect_build_outputs(['build']);

		// Should hash all 3 files
		expect(result).toHaveLength(3);
		expect(result.find((o) => o.path === 'build/file1.js')).toBeDefined();
		expect(result.find((o) => o.path === 'build/file2.js')).toBeDefined();
		expect(result.find((o) => o.path === 'build/file3.js')).toBeDefined();
	});

	test('hashes files from multiple directories', async () => {
		const {existsSync, readdirSync, readFileSync, statSync} = await import('node:fs');
		const {to_hash} = await import('./hash.ts');

		// Mock existsSync to return true for all directories
		vi.mocked(existsSync).mockReturnValue(true);

		// Mock readdirSync to return different files for each directory
		vi.mocked(readdirSync).mockImplementation((path: any) => {
			if (path === 'build') {
				return [{name: 'index.html', isDirectory: () => false, isFile: () => true}] as any;
			}
			if (path === 'dist') {
				return [{name: 'index.js', isDirectory: () => false, isFile: () => true}] as any;
			}
			if (path === 'dist_server') {
				return [{name: 'server.js', isDirectory: () => false, isFile: () => true}] as any;
			}
			return [] as any;
		});

		vi.mocked(statSync).mockReturnValue({
			size: 1024,
			mtimeMs: 1729512000000,
			ctimeMs: 1729512000000,
			mode: 33188,
		} as any);
		vi.mocked(readFileSync).mockReturnValue(Buffer.from('content'));

		let hash_count = 0;
		vi.mocked(to_hash).mockImplementation(async () => `hash${++hash_count}`);

		const result = await collect_build_outputs(['build', 'dist', 'dist_server']);

		// Should hash files from all three directories
		expect(result).toHaveLength(3);
		expect(result.find((o) => o.path === 'build/index.html')).toBeDefined();
		expect(result.find((o) => o.path === 'dist/index.js')).toBeDefined();
		expect(result.find((o) => o.path === 'dist_server/server.js')).toBeDefined();
		// Each file should have a unique hash
		expect(result.find((o) => o.path === 'build/index.html')?.hash).toBe('hash1');
		expect(result.find((o) => o.path === 'dist/index.js')?.hash).toBe('hash2');
		expect(result.find((o) => o.path === 'dist_server/server.js')?.hash).toBe('hash3');
	});

	test('hashes files in deeply nested directories', async () => {
		const {existsSync, readdirSync, readFileSync, statSync} = await import('node:fs');
		const {to_hash} = await import('./hash.ts');

		vi.mocked(existsSync).mockReturnValue(true);

		// Mock nested directory structure: build/assets/js/vendor/libs/
		vi.mocked(readdirSync).mockImplementation((path: any) => {
			const path_str = String(path);
			if (path_str === 'build') {
				return [{name: 'assets', isDirectory: () => true, isFile: () => false}] as any;
			}
			if (path_str === 'build/assets') {
				return [{name: 'js', isDirectory: () => true, isFile: () => false}] as any;
			}
			if (path_str === 'build/assets/js') {
				return [{name: 'vendor', isDirectory: () => true, isFile: () => false}] as any;
			}
			if (path_str === 'build/assets/js/vendor') {
				return [{name: 'libs', isDirectory: () => true, isFile: () => false}] as any;
			}
			if (path_str === 'build/assets/js/vendor/libs') {
				return [{name: 'foo.js', isDirectory: () => false, isFile: () => true}] as any;
			}
			return [] as any;
		});

		vi.mocked(statSync).mockReturnValue({
			size: 1024,
			mtimeMs: 1729512000000,
			ctimeMs: 1729512000000,
			mode: 33188,
		} as any);
		vi.mocked(readFileSync).mockReturnValue(Buffer.from('content'));
		vi.mocked(to_hash).mockResolvedValue('deep_hash');

		const result = await collect_build_outputs(['build']);

		// Should recursively hash deeply nested file
		const deep_file = result.find((o) => o.path === 'build/assets/js/vendor/libs/foo.js');
		expect(deep_file).toBeDefined();
		expect(deep_file?.hash).toBe('deep_hash');
	});
});

describe('create_build_cache_metadata', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('creates complete metadata object', async () => {
		const {git_current_commit_hash} = await import('@ryanatkn/belt/git.js');
		const {existsSync, readdirSync, statSync} = await import('node:fs');
		const {to_hash} = await import('./hash.ts');

		vi.mocked(git_current_commit_hash).mockResolvedValue('abc123');
		vi.mocked(existsSync).mockReturnValue(false);
		vi.mocked(readdirSync).mockReturnValue([]);
		vi.mocked(statSync).mockReturnValue({isDirectory: () => false} as any);
		vi.mocked(to_hash).mockResolvedValue('hash123');

		const config = create_mock_config();
		const log = create_mock_logger();

		const result = await create_build_cache_metadata(config, log);

		expect(result).toMatchObject({
			version: '1',
			git_commit: 'abc123',
		});
		expect(result.timestamp).toBeTruthy();
		expect(new Date(result.timestamp).getTime()).toBeGreaterThan(0);
	});
});

describe('race condition: cache file modification during validation', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('handles cache file being modified while reading', async () => {
		const {existsSync, readFileSync} = await import('node:fs');
		const {git_current_commit_hash} = await import('@ryanatkn/belt/git.js');
		const {to_hash} = await import('./hash.ts');

		const initial_metadata = create_mock_metadata({git_commit: 'abc123'});
		const modified_metadata = create_mock_metadata({git_commit: 'def456'});

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

		const config = create_mock_config();
		const log = create_mock_logger();

		// This represents a very unlikely race condition, but system should handle gracefully
		const result = await is_build_cache_valid(config, log);

		// Cache validation should happen with the initially loaded metadata
		// The result depends on when the validation happens vs when file is modified
		expect(typeof result).toBe('boolean');
	});

	test('handles concurrent cache writes', async () => {
		const {writeFileSync, mkdirSync} = await import('node:fs');

		const metadata1 = create_mock_metadata({git_commit: 'commit1'});
		const metadata2 = create_mock_metadata({git_commit: 'commit2'});

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
});

// Note: Integration tests for dirty workspace behavior (cache deletion, dist/ cleanup)
// belong in build.task.test.ts since that logic lives in build.task.ts, not here.
// The tests above cover the core build_cache module functions in isolation.
