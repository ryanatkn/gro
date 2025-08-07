// @slop Claude Sonnet 4

import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest';
import {readFile, lstat, realpath as realpathFn} from 'node:fs/promises';

import {Disknode} from './disknode.ts';
import type {Filer} from './filer.ts';
import type {Path_Id} from './path.ts';
import {create_mock_stats, TEST_PATHS} from './filer.test_helpers.ts';

// Mock filesystem modules
vi.mock('node:fs/promises', () => ({
	readFile: vi.fn(),
	lstat: vi.fn(),
	realpath: vi.fn(),
}));

// Also mock the sync version for any remaining usage
vi.mock('node:fs', () => ({
	existsSync: vi.fn(),
}));

// Test constants
const TEST_SYMLINK_PATH: Path_Id = '/test/project/src/symlink';
const TEST_FILE_PATH: Path_Id = TEST_PATHS.FILE_A;
const TEST_DIR_PATH: Path_Id = TEST_PATHS.SOURCE;
const TEST_BROKEN_SYMLINK: Path_Id = '/test/project/src/broken_symlink';
const TEST_CONTENT = 'export const value = 1;';

// Test helpers
const create_mock_filer = (): Filer =>
	({
		disknodes: new Map(),
		roots: new Set(),
		get_disknode: vi.fn((id: Path_Id) => new Disknode(id, create_mock_filer())),
		map_alias: vi.fn((spec: string) => spec),
		resolve_specifier: vi.fn(() => ({path_id: '/resolved/path.js'})),
		resolve_external_specifier: vi.fn().mockReturnValue('file:///resolved/external.js'),
		parse_imports_async: vi.fn().mockResolvedValue([]),
		load_resources_batch: vi.fn().mockResolvedValue(undefined),
	}) as unknown as Filer;

describe('Disknode Symlink Handling', () => {
	let filer: Filer;

	beforeEach(() => {
		filer = create_mock_filer();
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('symlink target directory handling', () => {
		test('returns null contents for symlink pointing to directory', async () => {
			const symlink_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => false,
				isSymbolicLink: () => true,
			});
			const dir_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => true,
			});

			// Mock symlink stats first, then target directory stats
			vi.mocked(lstat).mockResolvedValueOnce(symlink_stats);
			vi.mocked(realpathFn).mockResolvedValue('/test/somedir');
			vi.mocked(lstat).mockResolvedValueOnce(dir_stats);

			const node = new Disknode(TEST_SYMLINK_PATH, filer);

			await node.load_contents();
			const contents = node.contents;
			expect(contents).toBe(null);
			expect(vi.mocked(realpathFn)).toHaveBeenCalledWith(TEST_SYMLINK_PATH);
		});

		test('handles broken symlink target gracefully', async () => {
			const symlink_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => false,
				isSymbolicLink: () => true,
			});

			vi.mocked(lstat).mockResolvedValueOnce(symlink_stats);
			vi.mocked(realpathFn).mockResolvedValue('/test/nonexistent');
			// Mock target lstat to throw error
			vi.mocked(lstat).mockImplementationOnce(async () => {
				throw new Error('ENOENT');
			});

			const node = new Disknode(TEST_SYMLINK_PATH, filer);

			await node.load_contents();
			const contents = node.contents;
			expect(contents).toBe(null);
		});

		test('reads contents from symlink pointing to file', async () => {
			const symlink_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => false,
				isSymbolicLink: () => true,
			});
			const file_stats = create_mock_stats({
				isFile: () => true,
				isDirectory: () => false,
				size: 100,
			});

			// Mock symlink stats first, then target file stats
			vi.mocked(lstat).mockResolvedValueOnce(symlink_stats);
			vi.mocked(realpathFn).mockResolvedValue('/test/target.ts');
			vi.mocked(lstat).mockResolvedValueOnce(file_stats);
			vi.mocked(readFile).mockResolvedValue(TEST_CONTENT);

			const node = new Disknode(TEST_SYMLINK_PATH, filer);

			await node.load_contents();
			const contents = node.contents;
			expect(contents).toBe(TEST_CONTENT);
			expect(vi.mocked(readFile)).toHaveBeenCalledWith('/test/target.ts', 'utf8');
		});

		test('resolves nested symlinks', async () => {
			const symlink_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => false,
				isSymbolicLink: () => true,
			});
			const file_stats = create_mock_stats({
				isFile: () => true,
				isDirectory: () => false,
				size: 50,
			});

			// First symlink points to second symlink, which points to file
			vi.mocked(lstat).mockResolvedValueOnce(symlink_stats);
			vi.mocked(realpathFn).mockResolvedValue('/test/final_target.ts'); // realpath resolves fully
			vi.mocked(lstat).mockResolvedValueOnce(file_stats);
			vi.mocked(readFile).mockResolvedValue('final content');

			const node = new Disknode(TEST_SYMLINK_PATH, filer);

			await node.load_contents();
			const contents = node.contents;
			expect(contents).toBe('final content');
			expect(vi.mocked(readFile)).toHaveBeenCalledWith('/test/final_target.ts', 'utf8');
		});

		test('handles circular symlinks gracefully', async () => {
			const symlink_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => false,
				isSymbolicLink: () => true,
			});

			vi.mocked(lstat).mockResolvedValue(symlink_stats);
			// realpath would normally resolve circular symlinks or throw
			vi.mocked(realpathFn).mockImplementation(async () => {
				throw new Error('ELOOP: too many symbolic links encountered');
			});

			const node = new Disknode(TEST_SYMLINK_PATH, filer);

			// Should handle gracefully and return original path
			await node.load_realpath();
			const realpath = node.realpath;
			expect(realpath).toBe(TEST_SYMLINK_PATH);
		});

		test('detects symlink cycles with ELOOP error code', async () => {
			const symlink_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => false,
				isSymbolicLink: () => true,
			});

			vi.mocked(lstat).mockResolvedValue(symlink_stats);
			// Mock realpath to throw with specific ELOOP code
			const error: any = new Error('ELOOP: too many levels of symbolic links');
			error.code = 'ELOOP';
			vi.mocked(realpathFn).mockImplementation(async () => {
				throw error;
			});

			const node = new Disknode(TEST_SYMLINK_PATH, filer);

			// Should detect cycle and fall back to original path
			await node.load_realpath();
			const realpath = node.realpath;
			expect(realpath).toBe(TEST_SYMLINK_PATH);
		});

		test('detects symlink cycles with message pattern', async () => {
			const symlink_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => false,
				isSymbolicLink: () => true,
			});

			vi.mocked(lstat).mockResolvedValue(symlink_stats);
			// Mock different error message pattern that indicates cycles
			vi.mocked(realpathFn).mockImplementation(async () => {
				throw new Error('too many levels of symbolic links encountered');
			});

			const node = new Disknode(TEST_SYMLINK_PATH, filer);

			// Should detect cycle and fall back to original path
			await node.load_realpath();
			const realpath = node.realpath;
			expect(realpath).toBe(TEST_SYMLINK_PATH);
		});

		test('handles regular symlink errors differently from cycles', async () => {
			const symlink_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => false,
				isSymbolicLink: () => true,
			});

			vi.mocked(lstat).mockResolvedValue(symlink_stats);
			// Mock a different kind of error (not cycle related)
			vi.mocked(realpathFn).mockImplementation(async () => {
				throw new Error('ENOENT: no such file or directory');
			});

			const node = new Disknode(TEST_SYMLINK_PATH, filer);

			// Should still fall back to original path for broken symlinks
			await node.load_realpath();
			const realpath = node.realpath;
			expect(realpath).toBe(TEST_SYMLINK_PATH);
		});


		test('symlink to directory has null contents but valid stats', async () => {
			const symlink_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => false,
				isSymbolicLink: () => true,
				size: 0,
			});
			const dir_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => true,
			});

			vi.mocked(lstat).mockResolvedValueOnce(symlink_stats);
			vi.mocked(realpathFn).mockResolvedValue('/test/target_dir');
			vi.mocked(lstat).mockResolvedValueOnce(dir_stats);

			const node = new Disknode(TEST_SYMLINK_PATH, filer);

			// Load properties
			await node.load_stats();
			await node.load_contents();
			await node.load_realpath();

			// Stats should be for the symlink itself
			const stats = node.stats;
			expect(stats).toBe(symlink_stats);
			expect(node.kind).toBe('symlink');

			// Contents should be null because target is directory
			const contents = node.contents;
			expect(contents).toBe(null);

			// Realpath should resolve
			const realpath = node.realpath;
			expect(realpath).toBe('/test/target_dir');
		});

		test('symlink permissions affect readability', async () => {
			const symlink_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => false,
				isSymbolicLink: () => true,
			});
			const file_stats = create_mock_stats({
				isFile: () => true,
				isDirectory: () => false,
				size: 100,
			});

			vi.mocked(lstat).mockResolvedValueOnce(symlink_stats);
			vi.mocked(realpathFn).mockResolvedValue('/test/protected_file.ts');
			vi.mocked(lstat).mockResolvedValueOnce(file_stats);
			// Mock readFile to throw permission error
			vi.mocked(readFile).mockImplementation(async () => {
				throw new Error('EACCES: permission denied');
			});

			const node = new Disknode(TEST_SYMLINK_PATH, filer);

			await node.load_contents();
			const contents = node.contents;
			expect(contents).toBe(null);
		});
	});

	describe('realpath resolution', () => {
		test('returns original path for regular files', async () => {
			const file_stats = create_mock_stats({
				isFile: () => true,
				isDirectory: () => false,
			});
			vi.mocked(lstat).mockResolvedValue(file_stats);

			const node = new Disknode(TEST_FILE_PATH, filer);

			await node.load_realpath();
			const realpath = node.realpath;
			expect(realpath).toBe(TEST_FILE_PATH);
			expect(vi.mocked(realpathFn)).not.toHaveBeenCalled();
		});

		test('returns original path for directories', async () => {
			const dir_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => true,
			});
			vi.mocked(lstat).mockResolvedValue(dir_stats);

			const node = new Disknode(TEST_DIR_PATH, filer);

			await node.load_realpath();
			const realpath = node.realpath;
			expect(realpath).toBe(TEST_DIR_PATH);
			expect(vi.mocked(realpathFn)).not.toHaveBeenCalled();
		});

		test('resolves symlink paths', async () => {
			const symlink_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => false,
				isSymbolicLink: () => true,
			});
			vi.mocked(lstat).mockResolvedValue(symlink_stats);
			vi.mocked(realpathFn).mockResolvedValue('/resolved/target.ts');

			const node = new Disknode(TEST_SYMLINK_PATH, filer);

			await node.load_realpath();
			const realpath = node.realpath;
			expect(realpath).toBe('/resolved/target.ts');
			expect(vi.mocked(realpathFn)).toHaveBeenCalledWith(TEST_SYMLINK_PATH);
		});

		test('handles broken symlinks in realpath', async () => {
			const symlink_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => false,
				isSymbolicLink: () => true,
			});
			vi.mocked(lstat).mockResolvedValue(symlink_stats);
			vi.mocked(realpathFn).mockImplementation(async () => {
				throw new Error('ENOENT: no such file or directory');
			});

			const node = new Disknode(TEST_BROKEN_SYMLINK, filer);

			await node.load_realpath();
			const realpath = node.realpath;
			expect(realpath).toBe(TEST_BROKEN_SYMLINK); // Falls back to original path
		});

		test('caches realpath results for symlinks', async () => {
			const symlink_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => false,
				isSymbolicLink: () => true,
			});
			vi.mocked(lstat).mockResolvedValue(symlink_stats);
			vi.mocked(realpathFn).mockResolvedValue('/cached/target.ts');

			const node = new Disknode(TEST_SYMLINK_PATH, filer);

			await node.load_realpath();
			const realpath1 = node.realpath;
			const realpath2 = node.realpath;
			const realpath3 = node.realpath;

			expect(realpath1).toBe('/cached/target.ts');
			expect(realpath2).toBe('/cached/target.ts');
			expect(realpath3).toBe('/cached/target.ts');
			expect(vi.mocked(realpathFn)).toHaveBeenCalledTimes(1);
		});

		test('realpath invalidation and recaching', async () => {
			const symlink_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => false,
				isSymbolicLink: () => true,
			});
			vi.mocked(lstat).mockResolvedValue(symlink_stats);
			vi.mocked(realpathFn)
				.mockResolvedValueOnce('/first/target.ts')
				.mockResolvedValueOnce('/second/target.ts');

			const node = new Disknode(TEST_SYMLINK_PATH, filer);

			await node.load_realpath();
			const realpath1 = node.realpath;
			expect(realpath1).toBe('/first/target.ts');

			node.invalidate();

			await node.load_realpath();
			const realpath2 = node.realpath;
			expect(realpath2).toBe('/second/target.ts');
			expect(vi.mocked(realpathFn)).toHaveBeenCalledTimes(2);
		});

		test('realpath for non-existent files', async () => {
			vi.mocked(lstat).mockImplementation(async () => {
				throw new Error('ENOENT');
			});

			const node = new Disknode('/nonexistent/file.ts', filer);

			await node.load_realpath();
			const realpath = node.realpath;
			expect(realpath).toBe('/nonexistent/file.ts');
			expect(vi.mocked(realpathFn)).not.toHaveBeenCalled();
		});

		test('realpath version tracking', async () => {
			const symlink_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => false,
				isSymbolicLink: () => true,
			});
			vi.mocked(lstat).mockResolvedValue(symlink_stats);
			vi.mocked(realpathFn).mockResolvedValue('/versioned/target.ts');

			const node = new Disknode(TEST_SYMLINK_PATH, filer);

			expect(node.realpath_version).toBe(-1);

			await node.load_realpath();
			const realpath = node.realpath;
			expect(realpath).toBe('/versioned/target.ts');
			expect(node.realpath_version).toBe(0);

			// Second access should use cache
			node.realpath;
			expect(vi.mocked(realpathFn)).toHaveBeenCalledTimes(1);
		});
	});

	describe('symlink edge cases', () => {
		test('symlink to symlink to file (chain resolution)', async () => {
			const symlink_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => false,
				isSymbolicLink: () => true,
			});
			const file_stats = create_mock_stats({
				isFile: () => true,
				isDirectory: () => false,
				size: 123,
			});

			// Chain: symlink -> symlink -> file
			vi.mocked(lstat).mockResolvedValueOnce(symlink_stats);
			vi.mocked(realpathFn).mockResolvedValue('/final/file.ts'); // Resolves full chain
			vi.mocked(lstat).mockResolvedValueOnce(file_stats);
			vi.mocked(readFile).mockResolvedValue('chained content');

			const node = new Disknode(TEST_SYMLINK_PATH, filer);

			await node.load_contents();
			await node.load_realpath();

			const contents = node.contents;
			expect(contents).toBe('chained content');
			expect(node.realpath).toBe('/final/file.ts');
			expect(vi.mocked(readFile)).toHaveBeenCalledWith('/final/file.ts', 'utf8');
		});

		test('symlink to relative path resolution', async () => {
			const symlink_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => false,
				isSymbolicLink: () => true,
			});
			const file_stats = create_mock_stats({
				isFile: () => true,
				isDirectory: () => false,
				size: 50,
			});

			// Symlink with relative target
			vi.mocked(lstat).mockResolvedValueOnce(symlink_stats);
			vi.mocked(realpathFn).mockResolvedValue('/test/project/src/relative_target.ts');
			vi.mocked(lstat).mockResolvedValueOnce(file_stats);
			vi.mocked(readFile).mockResolvedValue('relative content');

			const node = new Disknode('/test/project/src/link_to_relative', filer);

			await node.load_contents();
			await node.load_realpath();

			const contents = node.contents;
			expect(contents).toBe('relative content');
			expect(node.realpath).toBe('/test/project/src/relative_target.ts');
		});

		test('symlink across filesystem boundaries', async () => {
			const symlink_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => false,
				isSymbolicLink: () => true,
			});
			const file_stats = create_mock_stats({
				isFile: () => true,
				isDirectory: () => false,
				size: 200,
			});

			vi.mocked(lstat).mockResolvedValueOnce(symlink_stats);
			vi.mocked(realpathFn).mockResolvedValue('/mnt/other/filesystem/target.ts');
			vi.mocked(lstat).mockResolvedValueOnce(file_stats);
			vi.mocked(readFile).mockResolvedValue('cross-filesystem content');

			const node = new Disknode(TEST_SYMLINK_PATH, filer);

			await node.load_contents();
			await node.load_realpath();

			const contents = node.contents;
			expect(contents).toBe('cross-filesystem content');
			expect(node.realpath).toBe('/mnt/other/filesystem/target.ts');
		});

		test('symlink with special characters in target path', async () => {
			const symlink_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => false,
				isSymbolicLink: () => true,
			});
			const file_stats = create_mock_stats({
				isFile: () => true,
				isDirectory: () => false,
				size: 75,
			});

			const special_path = '/test/path with spaces/and-symbols_$@#/target.ts';
			vi.mocked(lstat).mockResolvedValueOnce(symlink_stats);
			vi.mocked(realpathFn).mockResolvedValue(special_path);
			vi.mocked(lstat).mockResolvedValueOnce(file_stats);
			vi.mocked(readFile).mockResolvedValue('special path content');

			const node = new Disknode(TEST_SYMLINK_PATH, filer);

			await node.load_contents();
			await node.load_realpath();

			const contents = node.contents;
			expect(contents).toBe('special path content');
			expect(node.realpath).toBe(special_path);
			expect(vi.mocked(readFile)).toHaveBeenCalledWith(special_path, 'utf8');
		});

		test('multiple symlinks to same target (reference counting)', async () => {
			const symlink_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => false,
				isSymbolicLink: () => true,
			});
			const file_stats = create_mock_stats({
				isFile: () => true,
				isDirectory: () => false,
				size: 150,
			});

			const common_target = '/shared/target.ts';
			
			// Mock lstat to return symlink stats for the links and file stats for the target
			vi.mocked(lstat).mockImplementation(async (path: any) => {
				if (path === '/test/link1' || path === '/test/link2') {
					return symlink_stats;
				} else if (path === common_target) {
					return file_stats;
				}
				return symlink_stats; // default
			});
			
			vi.mocked(realpathFn).mockResolvedValue(common_target);
			vi.mocked(readFile).mockResolvedValue('shared content');

			const link1 = new Disknode('/test/link1', filer);
			const link2 = new Disknode('/test/link2', filer);

			// Load properties before accessing
			await link1.load_contents();
			await link1.load_realpath();
			await link2.load_contents();
			await link2.load_realpath();

			const contents1 = link1.contents;
			const contents2 = link2.contents;

			expect(contents1).toBe('shared content');
			expect(contents2).toBe('shared content');
			expect(link1.realpath).toBe(common_target);
			expect(link2.realpath).toBe(common_target);
		});

		test('symlink lifecycle: creation, modification, deletion', async () => {
			const symlink_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => false,
				isSymbolicLink: () => true,
			});

			// Initial target
			vi.mocked(lstat).mockResolvedValue(symlink_stats);
			vi.mocked(realpathFn)
				.mockResolvedValueOnce('/target1.ts')
				.mockResolvedValueOnce('/target2.ts')
				.mockImplementationOnce(async () => {
					throw new Error('ENOENT');
				});

			const node = new Disknode(TEST_SYMLINK_PATH, filer);

			// Initial state
			await node.load_realpath();
			expect(node.realpath).toBe('/target1.ts');

			// Simulate target change
			node.invalidate();
			await node.load_realpath();
			expect(node.realpath).toBe('/target2.ts');

			// Simulate symlink deletion/breakage
			node.invalidate();
			await node.load_realpath();
			expect(node.realpath).toBe(TEST_SYMLINK_PATH); // Falls back to original
		});
	});
});
