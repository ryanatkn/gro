import {describe, test, expect, vi, beforeEach} from 'vitest';
import type {FileSnapshotEntry} from '@fuzdev/fuz_util/file_snapshot.js';

import {discover_build_output_dirs, collect_build_outputs} from '../lib/build_cache.ts';

// Mock dependencies - discover_build_output_dirs still uses node:fs/promises directly
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

describe('discover_build_output_dirs', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('returns all existing build directories', async () => {
		const {fs_exists} = vi.mocked(await import('@fuzdev/fuz_util/fs.js'));
		const {readdir, stat} = vi.mocked(await import('node:fs/promises'));

		// Mock all directories exist
		vi.mocked(fs_exists).mockResolvedValue(true);
		vi.mocked(readdir).mockResolvedValue([
			'dist_server',
			'dist_worker',
			'node_modules',
			'src',
		] as any);
		vi.mocked(stat).mockResolvedValue({isDirectory: () => true} as any);

		const result = await discover_build_output_dirs();

		expect(result).toEqual(['build', 'dist', 'dist_server', 'dist_worker']);
	});

	test('returns only directories that exist', async () => {
		const {fs_exists} = vi.mocked(await import('@fuzdev/fuz_util/fs.js'));
		const {readdir, stat} = vi.mocked(await import('node:fs/promises'));

		// Only dist and dist_server exist
		vi.mocked(fs_exists).mockImplementation((path: any) => {
			return Promise.resolve(path === 'dist');
		});
		vi.mocked(readdir).mockResolvedValue(['dist_server', 'other'] as any);
		vi.mocked(stat).mockResolvedValue({isDirectory: () => true} as any);

		const result = await discover_build_output_dirs();

		expect(result).toEqual(['dist', 'dist_server']);
	});

	test('returns empty array when no build directories exist', async () => {
		const {fs_exists} = vi.mocked(await import('@fuzdev/fuz_util/fs.js'));
		const {readdir} = vi.mocked(await import('node:fs/promises'));

		vi.mocked(fs_exists).mockResolvedValue(false);
		vi.mocked(readdir).mockResolvedValue([] as any);

		const result = await discover_build_output_dirs();

		expect(result).toEqual([]);
	});

	test('filters out non-directory dist_ entries', async () => {
		const {fs_exists} = vi.mocked(await import('@fuzdev/fuz_util/fs.js'));
		const {readdir, stat} = vi.mocked(await import('node:fs/promises'));

		vi.mocked(fs_exists).mockImplementation((path: any) => Promise.resolve(path === 'build'));
		vi.mocked(readdir).mockResolvedValue([
			'dist_server',
			'dist_readme.md', // file, not directory
		] as any);
		vi.mocked(stat).mockImplementation((path: any) => {
			if (String(path) === 'dist_server') {
				return Promise.resolve({isDirectory: () => true} as any);
			}
			return Promise.resolve({isDirectory: () => false} as any);
		});

		const result = await discover_build_output_dirs();

		expect(result).toEqual(['build', 'dist_server']);
		expect(result).not.toContain('dist_readme.md');
	});

	test('handles permission errors on directory listing', async () => {
		const {fs_exists} = vi.mocked(await import('@fuzdev/fuz_util/fs.js'));
		const {readdir, stat} = vi.mocked(await import('node:fs/promises'));

		vi.mocked(fs_exists).mockResolvedValue(true);

		// readdir throws permission error
		vi.mocked(readdir).mockRejectedValue(new Error('EACCES: permission denied'));
		vi.mocked(stat).mockResolvedValue({isDirectory: () => true} as any);

		// Should throw - permission errors are fatal
		await expect(discover_build_output_dirs()).rejects.toThrow('EACCES: permission denied');
	});

	test('handles files named with dist_ prefix', async () => {
		const {fs_exists} = vi.mocked(await import('@fuzdev/fuz_util/fs.js'));
		const {readdir, stat} = vi.mocked(await import('node:fs/promises'));

		vi.mocked(fs_exists).mockResolvedValue(true);
		vi.mocked(readdir).mockResolvedValue([
			'dist_config.json', // file, not directory
			'dist_server', // directory
		] as any);

		// Mock stat to differentiate files vs directories
		vi.mocked(stat).mockImplementation((path: any) => {
			if (String(path) === 'dist_server') {
				return Promise.resolve({isDirectory: () => true} as any);
			}
			return Promise.resolve({isDirectory: () => false} as any);
		});

		const result = await discover_build_output_dirs();

		// Should include directory but not file
		expect(result).toContain('dist_server');
		expect(result).not.toContain('dist_config.json');
	});

	test('skips non-dist_ prefixed directories', async () => {
		const {fs_exists} = vi.mocked(await import('@fuzdev/fuz_util/fs.js'));
		const {readdir, stat} = vi.mocked(await import('node:fs/promises'));

		vi.mocked(fs_exists).mockResolvedValue(true);
		vi.mocked(readdir).mockResolvedValue([
			'node_modules',
			'src',
			'dist_server', // should be included
			'output', // should not be included
		] as any);
		vi.mocked(stat).mockResolvedValue({isDirectory: () => true} as any);

		const result = await discover_build_output_dirs();

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

	test('collects files from build directory via collect_file_snapshot', async () => {
		const {collect_file_snapshot} = vi.mocked(await import('@fuzdev/fuz_util/file_snapshot.js'));

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
				size: 2048,
				mtime: 1729512000000,
				ctime: 1729512000000,
				mode: 33188,
			},
		];
		vi.mocked(collect_file_snapshot).mockResolvedValue(mock_entries);

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
			size: 2048,
			mtime: 1729512000000,
			ctime: 1729512000000,
			mode: 33188,
		});
	});

	test('passes correct options including build.json filter', async () => {
		const {collect_file_snapshot} = vi.mocked(await import('@fuzdev/fuz_util/file_snapshot.js'));

		vi.mocked(collect_file_snapshot).mockResolvedValue([]);

		await collect_build_outputs(['build']);

		expect(collect_file_snapshot).toHaveBeenCalledWith({
			dirs: ['build'],
			fields: {hash: true, size: true, mtime: true, ctime: true, mode: true},
			filter: expect.any(Function),
			concurrency: 20,
		});

		// Verify the filter excludes build.json
		const call_args = vi.mocked(collect_file_snapshot).mock.calls[0]![0];
		expect(call_args.filter!('build/build.json')).toBe(false);
		expect(call_args.filter!('build/index.html')).toBe(true);
	});

	test('returns empty array when collect_file_snapshot returns empty', async () => {
		const {collect_file_snapshot} = vi.mocked(await import('@fuzdev/fuz_util/file_snapshot.js'));

		vi.mocked(collect_file_snapshot).mockResolvedValue([]);

		const result = await collect_build_outputs(['build']);

		expect(result).toEqual([]);
	});

	test('collects files from multiple directories', async () => {
		const {collect_file_snapshot} = vi.mocked(await import('@fuzdev/fuz_util/file_snapshot.js'));

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
				path: 'dist/index.js',
				hash: 'hash2',
				size: 2048,
				mtime: 1729512000000,
				ctime: 1729512000000,
				mode: 33188,
			},
			{
				path: 'dist_server/server.js',
				hash: 'hash3',
				size: 512,
				mtime: 1729512000000,
				ctime: 1729512000000,
				mode: 33188,
			},
		];
		vi.mocked(collect_file_snapshot).mockResolvedValue(mock_entries);

		const result = await collect_build_outputs(['build', 'dist', 'dist_server']);

		expect(result).toHaveLength(3);
		expect(collect_file_snapshot).toHaveBeenCalledWith(
			expect.objectContaining({dirs: ['build', 'dist', 'dist_server']}),
		);
	});

	test('maps FileSnapshotEntry fields to BuildOutputEntry', async () => {
		const {collect_file_snapshot} = vi.mocked(await import('@fuzdev/fuz_util/file_snapshot.js'));

		const mock_entries: Array<FileSnapshotEntry> = [
			{
				path: 'build/assets/js/vendor/libs/foo.js',
				hash: 'deep_hash',
				size: 256,
				mtime: 1729512000000,
				ctime: 1729512000000,
				mode: 33188,
			},
		];
		vi.mocked(collect_file_snapshot).mockResolvedValue(mock_entries);

		const result = await collect_build_outputs(['build']);

		const deep_file = result.find((o) => o.path === 'build/assets/js/vendor/libs/foo.js');
		expect(deep_file).toBeDefined();
		expect(deep_file?.hash).toBe('deep_hash');
		expect(deep_file?.size).toBe(256);
	});
});
