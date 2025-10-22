import {describe, test, expect, vi, beforeEach} from 'vitest';
import type {Logger} from '@ryanatkn/belt/log.js';

import {
	compute_build_cache_key,
	load_build_cache_metadata,
	save_build_cache_metadata,
	validate_build_cache,
	is_build_cache_valid,
	hash_build_outputs,
	create_build_cache_metadata,
	discover_build_output_dirs,
	type Build_Cache_Metadata,
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
	output_hashes: {},
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
			Buffer.from(JSON.stringify({api_url: 'https://example.com'}), 'utf-8'),
		);
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

	test('returns true when all output files match hashes', async () => {
		const {existsSync, readFileSync, statSync} = await import('node:fs');
		const {to_hash} = await import('./hash.ts');

		const metadata = create_mock_metadata({
			output_hashes: {
				'build/index.html': 'hash1',
				'build/bundle.js': 'hash2',
			},
		});

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(statSync).mockReturnValue({isFile: () => true} as any);
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
			output_hashes: {'build/index.html': 'hash1'},
		});

		vi.mocked(existsSync).mockReturnValue(false);

		const result = await validate_build_cache(metadata);

		expect(result).toBe(false);
	});

	test('returns false when output file hash does not match', async () => {
		const {existsSync, readFileSync, statSync} = await import('node:fs');
		const {to_hash} = await import('./hash.ts');

		const metadata = create_mock_metadata({
			output_hashes: {'build/index.html': 'expected_hash'},
		});

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(statSync).mockReturnValue({isFile: () => true} as any);
		vi.mocked(readFileSync).mockReturnValue(Buffer.from('content'));
		vi.mocked(to_hash).mockResolvedValue('different_hash');

		const result = await validate_build_cache(metadata);

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
});

describe('hash_build_outputs', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('hashes all files in build directory', async () => {
		const {existsSync, readdirSync, readFileSync} = await import('node:fs');
		const {to_hash} = await import('./hash.ts');

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readdirSync).mockReturnValue([
			{name: 'index.html', isDirectory: () => false, isFile: () => true},
			{name: 'bundle.js', isDirectory: () => false, isFile: () => true},
		] as any);
		vi.mocked(readFileSync).mockReturnValue(Buffer.from('content'));

		let hash_count = 0;
		vi.mocked(to_hash).mockImplementation(async () => `hash${++hash_count}`);

		const result = await hash_build_outputs(['build']);

		expect(result).toEqual({
			'build/index.html': 'hash1',
			'build/bundle.js': 'hash2',
		});
	});

	test('skips build.json file', async () => {
		const {existsSync, readdirSync, readFileSync} = await import('node:fs');
		const {to_hash} = await import('./hash.ts');

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readdirSync).mockReturnValue([
			{name: 'build.json', isDirectory: () => false, isFile: () => true},
			{name: 'index.html', isDirectory: () => false, isFile: () => true},
		] as any);
		vi.mocked(readFileSync).mockReturnValue(Buffer.from('content'));
		vi.mocked(to_hash).mockResolvedValue('hash');

		const result = await hash_build_outputs(['build']);

		expect(result).not.toHaveProperty('build/build.json');
		expect(result).toHaveProperty('build/index.html');
	});

	test('returns empty object for non-existent directory', async () => {
		const {existsSync} = await import('node:fs');

		vi.mocked(existsSync).mockReturnValue(false);

		const result = await hash_build_outputs(['build']);

		expect(result).toEqual({});
	});

	test('hashes all files in directory', async () => {
		const {existsSync, readdirSync, readFileSync} = await import('node:fs');
		const {to_hash} = await import('./hash.ts');

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readdirSync).mockReturnValue([
			{name: 'file1.js', isDirectory: () => false, isFile: () => true},
			{name: 'file2.js', isDirectory: () => false, isFile: () => true},
			{name: 'file3.js', isDirectory: () => false, isFile: () => true},
		] as any);
		vi.mocked(readFileSync).mockReturnValue(Buffer.from('content'));
		vi.mocked(to_hash).mockResolvedValue('hash');

		const result = await hash_build_outputs(['build']);

		// Should hash all 3 files
		expect(Object.keys(result).length).toBe(3);
		expect(result).toHaveProperty('build/file1.js');
		expect(result).toHaveProperty('build/file2.js');
		expect(result).toHaveProperty('build/file3.js');
	});

	test('hashes files from multiple directories', async () => {
		const {existsSync, readdirSync, readFileSync} = await import('node:fs');
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

		vi.mocked(readFileSync).mockReturnValue(Buffer.from('content'));

		let hash_count = 0;
		vi.mocked(to_hash).mockImplementation(async () => `hash${++hash_count}`);

		const result = await hash_build_outputs(['build', 'dist', 'dist_server']);

		// Should hash files from all three directories
		expect(Object.keys(result).length).toBe(3);
		expect(result).toHaveProperty('build/index.html');
		expect(result).toHaveProperty('dist/index.js');
		expect(result).toHaveProperty('dist_server/server.js');
		// Each file should have a unique hash
		expect(result['build/index.html']).toBe('hash1');
		expect(result['dist/index.js']).toBe('hash2');
		expect(result['dist_server/server.js']).toBe('hash3');
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

// Note: Integration tests for dirty workspace behavior (cache deletion, dist/ cleanup)
// belong in build.task.test.ts since that logic lives in build.task.ts, not here.
// The tests above cover the core build_cache module functions in isolation.
