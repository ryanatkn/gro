import {describe, test, expect, vi, beforeEach} from 'vitest';
import type {FileSnapshotEntry} from '@fuzdev/fuz_util/file_snapshot.js';

import {create_build_cache_metadata} from '../lib/build_cache.ts';

import {
	create_mock_logger,
	create_mock_config,
	mock_dir_stats,
} from './build_cache_test_helpers.ts';

// Mock dependencies
vi.mock('@fuzdev/fuz_util/git.js', () => ({
	git_current_commit_hash: vi.fn(),
}));

// Mock async fs functions for discover_build_output_dirs (still uses node:fs/promises directly)
vi.mock('node:fs/promises', () => ({
	readdir: vi.fn(),
	stat: vi.fn(),
}));

// Mock fs_exists from fuz_util (used by discover_build_output_dirs)
vi.mock('@fuzdev/fuz_util/fs.js', () => ({
	fs_exists: vi.fn(),
}));

// Mock file_snapshot from fuz_util (used by collect_build_outputs)
vi.mock('@fuzdev/fuz_util/file_snapshot.js', () => ({
	collect_file_snapshot: vi.fn(),
	validate_file_snapshot: vi.fn(),
}));

describe('create_build_cache_metadata', () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		// Set up default async mocks for discover_build_output_dirs
		const {fs_exists} = vi.mocked(await import('@fuzdev/fuz_util/fs.js'));
		const {readdir, stat} = vi.mocked(await import('node:fs/promises'));
		vi.mocked(fs_exists).mockResolvedValue(false);
		vi.mocked(readdir).mockResolvedValue([] as any);
		vi.mocked(stat).mockResolvedValue({isDirectory: () => true} as any);
	});

	test('creates complete metadata object', async () => {
		const {git_current_commit_hash} = await import('@fuzdev/fuz_util/git.js');
		const {collect_file_snapshot} = vi.mocked(await import('@fuzdev/fuz_util/file_snapshot.js'));

		vi.mocked(git_current_commit_hash).mockResolvedValue('abc123');
		vi.mocked(collect_file_snapshot).mockResolvedValue([]);

		const config = await create_mock_config();
		const log = create_mock_logger();

		const result = await create_build_cache_metadata(config, log);

		expect(result).toMatchObject({
			version: '1',
			git_commit: 'abc123',
		});
		expect(result.timestamp).toBeTruthy();
		expect(new Date(result.timestamp).getTime()).toBeGreaterThan(0);
	});

	test('creates metadata with actual build outputs', async () => {
		const {git_current_commit_hash} = await import('@fuzdev/fuz_util/git.js');
		const {fs_exists} = vi.mocked(await import('@fuzdev/fuz_util/fs.js'));
		const {readdir} = vi.mocked(await import('node:fs/promises'));
		const {collect_file_snapshot} = vi.mocked(await import('@fuzdev/fuz_util/file_snapshot.js'));

		vi.mocked(git_current_commit_hash).mockResolvedValue('abc123');
		vi.mocked(fs_exists).mockImplementation((path: any) => Promise.resolve(path === 'build'));
		vi.mocked(readdir).mockImplementation((path: any) => {
			if (path === '.') return Promise.resolve([] as any);
			return Promise.resolve([] as any);
		});

		// Mock collect_file_snapshot to return build outputs
		const mock_entries: Array<FileSnapshotEntry> = [
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
				size: 1024,
				mtime: 1729512000000,
				ctime: 1729512000000,
				mode: 33188,
			},
		];
		vi.mocked(collect_file_snapshot).mockResolvedValue(mock_entries);

		const config = await create_mock_config();
		const log = create_mock_logger();

		const result = await create_build_cache_metadata(config, log);

		expect(result.outputs).toHaveLength(2);
		expect(result.outputs[0]).toMatchObject({
			path: 'build/index.html',
			hash: 'hash1',
			size: 1024,
		});
		expect(result.outputs[1]).toMatchObject({
			path: 'build/bundle.js',
			hash: 'hash2',
			size: 1024,
		});
	});

	test('creates metadata with multiple build directories', async () => {
		const {git_current_commit_hash} = await import('@fuzdev/fuz_util/git.js');
		const {fs_exists} = vi.mocked(await import('@fuzdev/fuz_util/fs.js'));
		const {readdir, stat} = vi.mocked(await import('node:fs/promises'));
		const {collect_file_snapshot} = vi.mocked(await import('@fuzdev/fuz_util/file_snapshot.js'));

		vi.mocked(git_current_commit_hash).mockResolvedValue('abc123');

		vi.mocked(fs_exists).mockResolvedValue(true);
		// Set up async mocks for discover_build_output_dirs
		vi.mocked(readdir).mockImplementation((path: any) => {
			if (path === '.') {
				return Promise.resolve(['dist_server', 'src', 'node_modules'] as any);
			}
			return Promise.resolve([] as any);
		});
		vi.mocked(stat).mockResolvedValue(mock_dir_stats());

		// Mock collect_file_snapshot to return files from all dirs
		const mock_entries: Array<FileSnapshotEntry> = [
			{
				path: 'build/app.js',
				hash: 'hash1',
				size: 1024,
				mtime: 1729512000000,
				ctime: 1729512000000,
				mode: 33188,
			},
			{
				path: 'dist/lib.js',
				hash: 'hash2',
				size: 1024,
				mtime: 1729512000000,
				ctime: 1729512000000,
				mode: 33188,
			},
			{
				path: 'dist_server/server.js',
				hash: 'hash3',
				size: 1024,
				mtime: 1729512000000,
				ctime: 1729512000000,
				mode: 33188,
			},
		];
		vi.mocked(collect_file_snapshot).mockResolvedValue(mock_entries);

		const config = await create_mock_config();
		const log = create_mock_logger();

		const result = await create_build_cache_metadata(config, log);

		// Should have files from all three directories
		expect(result.outputs).toHaveLength(3);
		expect(result.outputs.find((o) => o.path === 'build/app.js')).toBeDefined();
		expect(result.outputs.find((o) => o.path === 'dist/lib.js')).toBeDefined();
		expect(result.outputs.find((o) => o.path === 'dist_server/server.js')).toBeDefined();
	});

	test('handles empty build directories', async () => {
		const {git_current_commit_hash} = await import('@fuzdev/fuz_util/git.js');
		const {fs_exists} = vi.mocked(await import('@fuzdev/fuz_util/fs.js'));
		const {readdir} = vi.mocked(await import('node:fs/promises'));
		const {collect_file_snapshot} = vi.mocked(await import('@fuzdev/fuz_util/file_snapshot.js'));

		vi.mocked(git_current_commit_hash).mockResolvedValue('abc123');
		vi.mocked(fs_exists).mockImplementation((path: any) => Promise.resolve(path === 'build'));
		vi.mocked(readdir).mockImplementation((path: any) => {
			if (path === '.') return Promise.resolve([] as any);
			return Promise.resolve([] as any);
		});
		vi.mocked(collect_file_snapshot).mockResolvedValue([]);

		const config = await create_mock_config();
		const log = create_mock_logger();

		const result = await create_build_cache_metadata(config, log);

		// Should succeed with empty outputs
		expect(result.outputs).toEqual([]);
		expect(result.git_commit).toBe('abc123');
	});

	test('creates metadata with deeply nested file structures', async () => {
		const {git_current_commit_hash} = await import('@fuzdev/fuz_util/git.js');
		const {fs_exists} = vi.mocked(await import('@fuzdev/fuz_util/fs.js'));
		const {readdir} = vi.mocked(await import('node:fs/promises'));
		const {collect_file_snapshot} = vi.mocked(await import('@fuzdev/fuz_util/file_snapshot.js'));

		vi.mocked(git_current_commit_hash).mockResolvedValue('abc123');
		vi.mocked(fs_exists).mockImplementation((path: any) => Promise.resolve(path === 'build'));
		vi.mocked(readdir).mockImplementation((path: any) => {
			if (path === '.') return Promise.resolve([] as any);
			return Promise.resolve([] as any);
		});

		// Mock collect_file_snapshot to return deeply nested file
		vi.mocked(collect_file_snapshot).mockResolvedValue([
			{
				path: 'build/assets/js/lib/utils/helper.js',
				hash: 'deep_hash',
				size: 256,
				mtime: 1729512000000,
				ctime: 1729512000000,
				mode: 33188,
			},
		]);

		const config = await create_mock_config();
		const log = create_mock_logger();

		const result = await create_build_cache_metadata(config, log);

		// Should find the deeply nested file
		expect(result.outputs).toHaveLength(1);
		expect(result.outputs[0]!.path).toBe('build/assets/js/lib/utils/helper.js');
		expect(result.outputs[0]!.size).toBe(256);
	});

	test('handles build directories with many files', async () => {
		const {git_current_commit_hash} = await import('@fuzdev/fuz_util/git.js');
		const {fs_exists} = vi.mocked(await import('@fuzdev/fuz_util/fs.js'));
		const {readdir} = vi.mocked(await import('node:fs/promises'));
		const {collect_file_snapshot} = vi.mocked(await import('@fuzdev/fuz_util/file_snapshot.js'));

		vi.mocked(git_current_commit_hash).mockResolvedValue('abc123');
		vi.mocked(fs_exists).mockImplementation((path: any) => Promise.resolve(path === 'build'));
		vi.mocked(readdir).mockImplementation((path: any) => {
			if (path === '.') return Promise.resolve([] as any);
			return Promise.resolve([] as any);
		});

		// Mock collect_file_snapshot to return many files
		const mock_entries: Array<FileSnapshotEntry> = Array.from({length: 15}, (_, i) => ({
			path: `build/file${i}.js`,
			hash: `hash${i}`,
			size: 2048,
			mtime: 1729512000000,
			ctime: 1729512000000,
			mode: 33188,
		}));
		vi.mocked(collect_file_snapshot).mockResolvedValue(mock_entries);

		const config = await create_mock_config();
		const log = create_mock_logger();

		const result = await create_build_cache_metadata(config, log);

		// Should have all 15 files
		expect(result.outputs).toHaveLength(15);
		// Verify all files are present
		for (let i = 0; i < 15; i++) {
			expect(result.outputs.find((o) => o.path === `build/file${i}.js`)).toBeDefined();
		}
	});

	test('creates metadata with null git commit', async () => {
		const {git_current_commit_hash} = await import('@fuzdev/fuz_util/git.js');
		const {collect_file_snapshot} = vi.mocked(await import('@fuzdev/fuz_util/file_snapshot.js'));

		vi.mocked(git_current_commit_hash).mockResolvedValue(null);
		vi.mocked(collect_file_snapshot).mockResolvedValue([]);

		const config = await create_mock_config();
		const log = create_mock_logger();

		const result = await create_build_cache_metadata(config, log);

		// Should have null git commit
		expect(result.git_commit).toBeNull();
		expect(result.version).toBe('1');
		expect(result.timestamp).toBeTruthy();
		expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('Not in a git repository'));
	});

	test('includes correct build_cache_config_hash', async () => {
		const {git_current_commit_hash} = await import('@fuzdev/fuz_util/git.js');
		const {collect_file_snapshot} = vi.mocked(await import('@fuzdev/fuz_util/file_snapshot.js'));

		vi.mocked(git_current_commit_hash).mockResolvedValue('abc123');
		vi.mocked(collect_file_snapshot).mockResolvedValue([]);

		const config = await create_mock_config({
			build_cache_config: {
				api_endpoint: 'https://api.fuz.dev',
				feature_flags: {experimental: true},
			},
		});
		const log = create_mock_logger();

		const result = await create_build_cache_metadata(config, log);

		// Should include a non-empty hashed config
		expect(result.build_cache_config_hash).toBeTruthy();
		expect(result.build_cache_config_hash.length).toBeGreaterThan(0);
		expect(result.git_commit).toBe('abc123');
	});
});
