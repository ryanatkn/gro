// @slop Claude Sonnet 4

import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest';
import {readFileSync, lstatSync, realpathSync} from 'node:fs';

import {Disknode} from './disknode.ts';
import type {Filer} from './filer.ts';
import type {Path_Id} from './path.ts';
import {create_mock_stats, TEST_PATHS} from './filer.test_helpers.ts';

// Mock filesystem modules
vi.mock('node:fs', () => ({
	readFileSync: vi.fn(),
	lstatSync: vi.fn(),
	realpathSync: vi.fn(),
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
		parse_imports: vi.fn().mockReturnValue([]),
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
		test('returns null contents for symlink pointing to directory', () => {
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
			vi.mocked(lstatSync).mockReturnValueOnce(symlink_stats);
			vi.mocked(realpathSync).mockReturnValue('/test/somedir');
			vi.mocked(lstatSync).mockReturnValueOnce(dir_stats);

			const node = new Disknode(TEST_SYMLINK_PATH, filer);

			const contents = node.contents;
			expect(contents).toBe(null);
			expect(vi.mocked(realpathSync)).toHaveBeenCalledWith(TEST_SYMLINK_PATH);
		});

		test('handles broken symlink target gracefully', () => {
			const symlink_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => false,
				isSymbolicLink: () => true,
			});

			vi.mocked(lstatSync).mockReturnValueOnce(symlink_stats);
			vi.mocked(realpathSync).mockReturnValue('/test/nonexistent');
			// Mock target lstat to throw error
			vi.mocked(lstatSync).mockImplementationOnce(() => {
				throw new Error('ENOENT');
			});

			const node = new Disknode(TEST_SYMLINK_PATH, filer);

			const contents = node.contents;
			expect(contents).toBe(null);
		});

		test('reads contents from symlink pointing to file', () => {
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
			vi.mocked(lstatSync).mockReturnValueOnce(symlink_stats);
			vi.mocked(realpathSync).mockReturnValue('/test/target.ts');
			vi.mocked(lstatSync).mockReturnValueOnce(file_stats);
			vi.mocked(readFileSync).mockReturnValue(TEST_CONTENT);

			const node = new Disknode(TEST_SYMLINK_PATH, filer);

			const contents = node.contents;
			expect(contents).toBe(TEST_CONTENT);
			expect(vi.mocked(readFileSync)).toHaveBeenCalledWith('/test/target.ts', 'utf8');
		});

		test('resolves nested symlinks', () => {
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
			vi.mocked(lstatSync).mockReturnValueOnce(symlink_stats);
			vi.mocked(realpathSync).mockReturnValue('/test/final_target.ts'); // realpathSync resolves fully
			vi.mocked(lstatSync).mockReturnValueOnce(file_stats);
			vi.mocked(readFileSync).mockReturnValue('final content');

			const node = new Disknode(TEST_SYMLINK_PATH, filer);

			const contents = node.contents;
			expect(contents).toBe('final content');
			expect(vi.mocked(readFileSync)).toHaveBeenCalledWith('/test/final_target.ts', 'utf8');
		});

		test('handles circular symlinks gracefully', () => {
			const symlink_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => false,
				isSymbolicLink: () => true,
			});

			vi.mocked(lstatSync).mockReturnValue(symlink_stats);
			// realpathSync would normally resolve circular symlinks or throw
			vi.mocked(realpathSync).mockImplementation(() => {
				throw new Error('ELOOP: too many symbolic links encountered');
			});

			const node = new Disknode(TEST_SYMLINK_PATH, filer);

			// Should handle gracefully and return original path
			const realpath = node.realpath;
			expect(realpath).toBe(TEST_SYMLINK_PATH);
		});

		test('symlink to directory has null contents but valid stats', () => {
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

			vi.mocked(lstatSync).mockReturnValueOnce(symlink_stats);
			vi.mocked(realpathSync).mockReturnValue('/test/target_dir');
			vi.mocked(lstatSync).mockReturnValueOnce(dir_stats);

			const node = new Disknode(TEST_SYMLINK_PATH, filer);

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

		test('symlink permissions affect readability', () => {
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

			vi.mocked(lstatSync).mockReturnValueOnce(symlink_stats);
			vi.mocked(realpathSync).mockReturnValue('/test/protected_file.ts');
			vi.mocked(lstatSync).mockReturnValueOnce(file_stats);
			// Mock readFileSync to throw permission error
			vi.mocked(readFileSync).mockImplementation(() => {
				throw new Error('EACCES: permission denied');
			});

			const node = new Disknode(TEST_SYMLINK_PATH, filer);

			const contents = node.contents;
			expect(contents).toBe(null);
		});
	});

	describe('realpath resolution', () => {
		test('returns original path for regular files', () => {
			const file_stats = create_mock_stats({
				isFile: () => true,
				isDirectory: () => false,
			});
			vi.mocked(lstatSync).mockReturnValue(file_stats);

			const node = new Disknode(TEST_FILE_PATH, filer);

			const realpath = node.realpath;
			expect(realpath).toBe(TEST_FILE_PATH);
			expect(vi.mocked(realpathSync)).not.toHaveBeenCalled();
		});

		test('returns original path for directories', () => {
			const dir_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => true,
			});
			vi.mocked(lstatSync).mockReturnValue(dir_stats);

			const node = new Disknode(TEST_DIR_PATH, filer);

			const realpath = node.realpath;
			expect(realpath).toBe(TEST_DIR_PATH);
			expect(vi.mocked(realpathSync)).not.toHaveBeenCalled();
		});

		test('resolves symlink paths', () => {
			const symlink_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => false,
				isSymbolicLink: () => true,
			});
			vi.mocked(lstatSync).mockReturnValue(symlink_stats);
			vi.mocked(realpathSync).mockReturnValue('/resolved/target.ts');

			const node = new Disknode(TEST_SYMLINK_PATH, filer);

			const realpath = node.realpath;
			expect(realpath).toBe('/resolved/target.ts');
			expect(vi.mocked(realpathSync)).toHaveBeenCalledWith(TEST_SYMLINK_PATH);
		});

		test('handles broken symlinks in realpath', () => {
			const symlink_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => false,
				isSymbolicLink: () => true,
			});
			vi.mocked(lstatSync).mockReturnValue(symlink_stats);
			vi.mocked(realpathSync).mockImplementation(() => {
				throw new Error('ENOENT: no such file or directory');
			});

			const node = new Disknode(TEST_BROKEN_SYMLINK, filer);

			const realpath = node.realpath;
			expect(realpath).toBe(TEST_BROKEN_SYMLINK); // Falls back to original path
		});

		test('caches realpath results for symlinks', () => {
			const symlink_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => false,
				isSymbolicLink: () => true,
			});
			vi.mocked(lstatSync).mockReturnValue(symlink_stats);
			vi.mocked(realpathSync).mockReturnValue('/cached/target.ts');

			const node = new Disknode(TEST_SYMLINK_PATH, filer);

			const realpath1 = node.realpath;
			const realpath2 = node.realpath;
			const realpath3 = node.realpath;

			expect(realpath1).toBe('/cached/target.ts');
			expect(realpath2).toBe('/cached/target.ts');
			expect(realpath3).toBe('/cached/target.ts');
			expect(vi.mocked(realpathSync)).toHaveBeenCalledTimes(1);
		});

		test('realpath invalidation and recaching', () => {
			const symlink_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => false,
				isSymbolicLink: () => true,
			});
			vi.mocked(lstatSync).mockReturnValue(symlink_stats);
			vi.mocked(realpathSync)
				.mockReturnValueOnce('/first/target.ts')
				.mockReturnValueOnce('/second/target.ts');

			const node = new Disknode(TEST_SYMLINK_PATH, filer);

			const realpath1 = node.realpath;
			expect(realpath1).toBe('/first/target.ts');

			node.invalidate();

			const realpath2 = node.realpath;
			expect(realpath2).toBe('/second/target.ts');
			expect(vi.mocked(realpathSync)).toHaveBeenCalledTimes(2);
		});

		test('realpath for non-existent files', () => {
			vi.mocked(lstatSync).mockImplementation(() => {
				throw new Error('ENOENT');
			});

			const node = new Disknode('/nonexistent/file.ts', filer);

			const realpath = node.realpath;
			expect(realpath).toBe('/nonexistent/file.ts');
			expect(vi.mocked(realpathSync)).not.toHaveBeenCalled();
		});

		test('realpath version tracking', () => {
			const symlink_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => false,
				isSymbolicLink: () => true,
			});
			vi.mocked(lstatSync).mockReturnValue(symlink_stats);
			vi.mocked(realpathSync).mockReturnValue('/versioned/target.ts');

			const node = new Disknode(TEST_SYMLINK_PATH, filer);

			expect(node.realpath_version).toBe(-1);

			const realpath = node.realpath;
			expect(realpath).toBe('/versioned/target.ts');
			expect(node.realpath_version).toBe(0);

			// Second access should use cache
			node.realpath;
			expect(vi.mocked(realpathSync)).toHaveBeenCalledTimes(1);
		});
	});

	describe('symlink edge cases', () => {
		test('symlink to symlink to file (chain resolution)', () => {
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
			vi.mocked(lstatSync).mockReturnValueOnce(symlink_stats);
			vi.mocked(realpathSync).mockReturnValue('/final/file.ts'); // Resolves full chain
			vi.mocked(lstatSync).mockReturnValueOnce(file_stats);
			vi.mocked(readFileSync).mockReturnValue('chained content');

			const node = new Disknode(TEST_SYMLINK_PATH, filer);

			const contents = node.contents;
			expect(contents).toBe('chained content');
			expect(node.realpath).toBe('/final/file.ts');
			expect(vi.mocked(readFileSync)).toHaveBeenCalledWith('/final/file.ts', 'utf8');
		});

		test('symlink to relative path resolution', () => {
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
			vi.mocked(lstatSync).mockReturnValueOnce(symlink_stats);
			vi.mocked(realpathSync).mockReturnValue('/test/project/src/relative_target.ts');
			vi.mocked(lstatSync).mockReturnValueOnce(file_stats);
			vi.mocked(readFileSync).mockReturnValue('relative content');

			const node = new Disknode('/test/project/src/link_to_relative', filer);

			const contents = node.contents;
			expect(contents).toBe('relative content');
			expect(node.realpath).toBe('/test/project/src/relative_target.ts');
		});

		test('symlink across filesystem boundaries', () => {
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

			vi.mocked(lstatSync).mockReturnValueOnce(symlink_stats);
			vi.mocked(realpathSync).mockReturnValue('/mnt/other/filesystem/target.ts');
			vi.mocked(lstatSync).mockReturnValueOnce(file_stats);
			vi.mocked(readFileSync).mockReturnValue('cross-filesystem content');

			const node = new Disknode(TEST_SYMLINK_PATH, filer);

			const contents = node.contents;
			expect(contents).toBe('cross-filesystem content');
			expect(node.realpath).toBe('/mnt/other/filesystem/target.ts');
		});

		test('symlink with special characters in target path', () => {
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
			vi.mocked(lstatSync).mockReturnValueOnce(symlink_stats);
			vi.mocked(realpathSync).mockReturnValue(special_path);
			vi.mocked(lstatSync).mockReturnValueOnce(file_stats);
			vi.mocked(readFileSync).mockReturnValue('special path content');

			const node = new Disknode(TEST_SYMLINK_PATH, filer);

			const contents = node.contents;
			expect(contents).toBe('special path content');
			expect(node.realpath).toBe(special_path);
			expect(vi.mocked(readFileSync)).toHaveBeenCalledWith(special_path, 'utf8');
		});

		test('multiple symlinks to same target (reference counting)', () => {
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
			
			// Mock lstatSync to return symlink stats for the links and file stats for the target
			vi.mocked(lstatSync).mockImplementation((path: any) => {
				if (path === '/test/link1' || path === '/test/link2') {
					return symlink_stats;
				} else if (path === common_target) {
					return file_stats;
				}
				return symlink_stats; // default
			});
			
			vi.mocked(realpathSync).mockReturnValue(common_target);
			vi.mocked(readFileSync).mockReturnValue('shared content');

			const link1 = new Disknode('/test/link1', filer);
			const link2 = new Disknode('/test/link2', filer);

			// Access contents first to trigger symlink detection
			const contents1 = link1.contents;
			const contents2 = link2.contents;

			expect(contents1).toBe('shared content');
			expect(contents2).toBe('shared content');
			expect(link1.realpath).toBe(common_target);
			expect(link2.realpath).toBe(common_target);
		});

		test('symlink lifecycle: creation, modification, deletion', () => {
			const symlink_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => false,
				isSymbolicLink: () => true,
			});

			// Initial target
			vi.mocked(lstatSync).mockReturnValue(symlink_stats);
			vi.mocked(realpathSync)
				.mockReturnValueOnce('/target1.ts')
				.mockReturnValueOnce('/target2.ts')
				.mockImplementationOnce(() => {
					throw new Error('ENOENT');
				});

			const node = new Disknode(TEST_SYMLINK_PATH, filer);

			// Initial state
			expect(node.realpath).toBe('/target1.ts');

			// Simulate target change
			node.invalidate();
			expect(node.realpath).toBe('/target2.ts');

			// Simulate symlink deletion/breakage
			node.invalidate();
			expect(node.realpath).toBe(TEST_SYMLINK_PATH); // Falls back to original
		});
	});
});
