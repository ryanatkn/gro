import {describe, test, expect, vi, beforeEach} from 'vitest';

import {discover_build_output_dirs, collect_build_outputs} from '../lib/build_cache.ts';

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
		const {to_hash} = await import('$lib/hash.js');

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
		// eslint-disable-next-line @typescript-eslint/require-await
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
		const {to_hash} = await import('$lib/hash.js');

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
		const {to_hash} = await import('$lib/hash.js');

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
		const {to_hash} = await import('$lib/hash.js');

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
		// eslint-disable-next-line @typescript-eslint/require-await
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
		const {to_hash} = await import('$lib/hash.js');

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
