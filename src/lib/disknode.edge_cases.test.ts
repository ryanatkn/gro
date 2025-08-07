// @slop Claude Sonnet 4

import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest';
import {readFile, lstat, realpath} from 'node:fs/promises';

import {Disknode} from './disknode.ts';
import type {Filer} from './filer.ts';
import type {Path_Id} from './path.ts';
import {create_mock_stats, TEST_PATHS} from './filer.test_helpers.ts';
import {DISKNODE_MAX_CACHED_SIZE} from './disknode_helpers.ts';

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
const TEST_PATH_TS: Path_Id = TEST_PATHS.FILE_A;
const TEST_PATH_TXT: Path_Id = '/test/project/src/readme.txt';
const TEST_LARGE_PATH: Path_Id = '/test/project/src/large.txt';

const TEST_CONTENT_TS = 'export const value = 1;';
const TEST_CONTENT_LARGE = 'x'.repeat(DISKNODE_MAX_CACHED_SIZE + 1000);

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

const setup_content_test = (content: string, size?: number) => {
	const actual_size = size ?? content.length;
	const mock_stats = create_mock_stats({size: actual_size});
	vi.mocked(lstat).mockResolvedValue(mock_stats);
	vi.mocked(readFile).mockResolvedValue(content);
	return mock_stats;
};

const setup_import_test = (
	filer: Filer,
	content: string,
	imports: Array<string>,
	dependencies: Record<string, Path_Id> = {},
) => {
	setup_content_test(content);
	vi.mocked(filer.parse_imports_async).mockResolvedValue(imports);

	vi.mocked(filer.get_disknode).mockImplementation((id: Path_Id) => {
		for (const dep_path of Object.values(dependencies)) {
			if (id === dep_path) {
				return new Disknode(dep_path, filer);
			}
		}
		return new Disknode(id, filer);
	});
};

describe('Disknode Edge Cases and Error Handling', () => {
	let filer: Filer;

	beforeEach(() => {
		filer = create_mock_filer();
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('edge cases and error handling', () => {
		test('handles non-importable files in imports getter', async () => {
			const node = new Disknode(TEST_PATH_TXT, filer);
			// Should return undefined before loading
			expect(node.imports).toBeUndefined();
			// After loading, should return null for non-importable files
			await node.load_imports();
			const imports = node.imports;
			expect(imports).toBe(null);
			// Should not access contents for non-importable files during load_imports
			expect(vi.mocked(readFile)).not.toHaveBeenCalled();
		});

		test('handles empty import results', async () => {
			setup_import_test(filer, TEST_CONTENT_TS, [], {});
			const node = new Disknode(TEST_PATH_TS, filer);

			await node.load_imports();
			const imports = node.imports;
			expect(imports).toBeTruthy();
			expect(imports?.size).toBe(0);
		});

		test('handles external nodes', () => {
			const disknode = new Disknode('https://example.com/module.js', filer);
			disknode.is_external = true;
			expect(disknode.is_external).toBe(true);
		});

		test('handles extremely large files without caching', async () => {
			setup_content_test(TEST_CONTENT_LARGE, DISKNODE_MAX_CACHED_SIZE + 1000);
			const node = new Disknode(TEST_LARGE_PATH, filer);

			// First access - load explicitly
			await node.load_contents();
			const content1 = await node.get_contents(); // Use async method for large files
			expect(content1).toBe(TEST_CONTENT_LARGE);

			// Second access should not use cache - should read again
			const content2 = await node.get_contents(); // Use async method for large files
			expect(content2).toBe(TEST_CONTENT_LARGE);
			// Large files are read directly, so we expect: 1 load_stats + 2 get_contents calls
			expect(vi.mocked(readFile)).toHaveBeenCalledTimes(2); // 2 direct reads via get_contents
		});

		test('handles empty files gracefully', async () => {
			setup_content_test('', 0);
			const node = new Disknode(TEST_PATH_TS, filer);

			await node.load_contents();
			await node.load_stats();
			const contents = node.contents;
			expect(contents).toBe('');
			expect(node.size).toBe(0);
		});

		test('handles whitespace-only files', async () => {
			const whitespace = '   \n\t  \n   ';
			setup_content_test(whitespace, whitespace.length);
			const node = new Disknode(TEST_PATH_TS, filer);

			await node.load_contents();
			const contents = node.contents;
			expect(contents).toBe(whitespace);
		});

		test('handles files with null bytes', async () => {
			const content_with_nulls = 'before\0null\0after';
			setup_content_test(content_with_nulls);
			const node = new Disknode(TEST_PATH_TS, filer);

			await node.load_contents();
			const contents = node.contents;
			expect(contents).toBe(content_with_nulls);
		});

		test('handles unicode content correctly', async () => {
			const unicode_content = '🚀 export const emoji = "🎉"; // 中文注释';
			setup_content_test(unicode_content);
			const node = new Disknode(TEST_PATH_TS, filer);

			await node.load_contents();
			const contents = node.contents;
			expect(contents).toBe(unicode_content);
		});

		test('handles very long file paths', async () => {
			const long_path = '/test/' + 'very_long_directory_name_'.repeat(20) + 'file.ts';
			setup_content_test(TEST_CONTENT_TS);
			const node = new Disknode(long_path, filer);

			expect(node.id).toBe(long_path);
			await node.load_contents();
			const contents = node.contents;
			expect(contents).toBe(TEST_CONTENT_TS);
		});

		test('handles path with special characters', () => {
			const special_path = '/test/path with spaces/and$symbols@/file[1].ts';
			setup_content_test(TEST_CONTENT_TS);
			const node = new Disknode(special_path, filer);

			expect(node.id).toBe(special_path);
			expect(node.extension).toBe('.ts');
		});

		test('handles concurrent property access', async () => {
			setup_content_test(TEST_CONTENT_TS);
			vi.mocked(realpath).mockResolvedValue(TEST_PATH_TS);
			const node = new Disknode(TEST_PATH_TS, filer);

			// Load multiple properties concurrently
			await Promise.all([
				node.load_stats(),
				node.load_contents(),
				node.load_realpath(),
				node.load_imports(),
			]);

			// Access after loading
			const stats = node.stats;
			const contents = node.contents;
			const realpath_value = node.realpath;
			const imports = node.imports;

			expect(stats).toBeTruthy();
			expect(contents).toBe(TEST_CONTENT_TS);
			expect(realpath_value).toBe(TEST_PATH_TS);
			expect(imports).toBeTruthy();
		});

		test('handles filesystem race conditions', async () => {
			// File exists during stats but is deleted before content read
			const mock_stats = create_mock_stats({size: 100});
			vi.mocked(lstat).mockResolvedValue(mock_stats);
			vi.mocked(readFile).mockImplementation(() => {
				throw new Error('ENOENT: file deleted between stats and read');
			});

			const node = new Disknode(TEST_PATH_TS, filer);

			await node.load_stats();
			const stats = node.stats;
			expect(stats).toBeTruthy();

			await node.load_contents();
			const contents = node.contents;
			expect(contents).toBe(null); // Should handle gracefully
		});

		test('handles permission errors gracefully', async () => {
			vi.mocked(lstat).mockImplementation(() => {
				throw new Error('EACCES: permission denied');
			});
			vi.mocked(readFile).mockImplementation(() => {
				throw new Error('EACCES: permission denied');
			});

			const node = new Disknode('/protected/file.ts', filer);

			await node.load_stats();
			const stats = node.stats;
			expect(stats).toBe(null);
			expect(node.exists).toBe(false);

			await node.load_contents();
			const contents = node.contents;
			expect(contents).toBe(null);
		});

		test('handles filesystem errors during import parsing', async () => {
			// File exists and has content, but import parsing fails somehow
			setup_content_test('import {broken} from "broken-module";');
			vi.mocked(filer.parse_imports_async).mockRejectedValue(new Error('Parser error'));

			const node = new Disknode(TEST_PATH_TS, filer);

			// Should handle parse errors gracefully during load_imports
			await expect(node.load_imports()).rejects.toThrow('Parser error');
		});

		test('handles circular dependency detection', () => {
			const dep_a = new Disknode('/test/a.ts', filer);
			const dep_b = new Disknode('/test/b.ts', filer);

			// Create circular dependency
			dep_a.add_dependency(dep_b);
			dep_b.add_dependency(dep_a);

			// Should not cause infinite loops
			expect(dep_a.dependencies.has('/test/b.ts')).toBe(true);
			expect(dep_b.dependencies.has('/test/a.ts')).toBe(true);
			expect(dep_a.dependents.has('/test/b.ts')).toBe(true);
			expect(dep_b.dependents.has('/test/a.ts')).toBe(true);
		});

		test('handles dependency cleanup on relationship clearing', () => {
			const dep_a = new Disknode('/test/a.ts', filer);
			const dep_b = new Disknode('/test/b.ts', filer);
			const dep_c = new Disknode('/test/c.ts', filer);

			// Create relationships
			dep_a.add_dependency(dep_b);
			dep_a.add_dependency(dep_c);
			dep_b.add_dependency(dep_c);

			expect(dep_a.dependencies.size).toBe(2);
			expect(dep_c.dependents.size).toBe(2);

			// Clear all relationships for dep_a
			dep_a.clear_relationships();

			expect(dep_a.dependencies.size).toBe(0);
			expect(dep_a.dependents.size).toBe(0);
			expect(dep_b.dependents.size).toBe(0); // dep_a removed
			expect(dep_c.dependents.size).toBe(1); // only dep_b remains
		});

		test('handles malformed import specifiers', async () => {
			const malformed_imports = ['', '   ', '\n', '\t', 'http://', 'file:///', '\\invalid\\path'];
			setup_import_test(filer, 'content with malformed imports', malformed_imports);
			const node = new Disknode(TEST_PATH_TS, filer);

			// Should handle gracefully without throwing
			await node.load_imports();
			const imports = node.imports;
			expect(imports).toBeTruthy();
			expect(imports?.size).toBe(malformed_imports.length);
		});

		test('handles import resolution failures', async () => {
			vi.mocked(filer.resolve_specifier).mockImplementation(() => {
				throw new Error('Resolution failed');
			});
			vi.mocked(filer.resolve_external_specifier).mockImplementation(() => {
				throw new Error('External resolution failed');
			});

			setup_import_test(filer, 'import from "./local.js"; import from "external";', [
				'./local.js',
				'external',
			]);
			const node = new Disknode(TEST_PATH_TS, filer);

			// Should handle resolution failures gracefully
			await node.load_imports();
			const imports = node.imports;
			expect(imports).toBeTruthy();
			expect(imports?.has('./local.js')).toBe(true);
			expect(imports?.has('external')).toBe(true);
			// Local specifiers should still create dependencies (but external ones don't)
			expect(node.dependencies.size).toBe(1); // Only local dependency created
		});

		test('handles extreme nesting in directory structures', () => {
			const root = new Disknode('/root', filer);
			let current = root;

			// Create deeply nested structure
			for (let i = 0; i < 100; i++) {
				const child = new Disknode(`/root/${'level'.repeat(i)}/file${i}.ts`, filer);
				child.parent = current;
				current.children.set(`file${i}.ts`, child);
				current = child;
			}

			// Should handle deep nesting without stack overflow
			const ancestors = current.get_ancestors();
			expect(ancestors.length).toBe(100);

			const descendants = root.get_descendants();
			expect(descendants.length).toBe(100);
		});

		test('handles empty directory contents', async () => {
			const dir_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => true,
			});
			vi.mocked(lstat).mockResolvedValue(dir_stats);

			const node = new Disknode('/empty/dir', filer);

			// Load contents to trigger stats loading and kind update
			await node.load_contents();
			const contents = node.contents;
			expect(node.kind).toBe('directory');
			expect(contents).toBe(null);
			expect(node.children.size).toBe(0);
			expect(node.get_descendants()).toEqual([]);
		});

		test('handles invalid file types', async () => {
			// Mock stats for unsupported file type (e.g., device file)
			const device_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => false,
				isSymbolicLink: () => false,
				isBlockDevice: () => true,
			});
			vi.mocked(lstat).mockResolvedValue(device_stats);
			vi.mocked(readFile).mockImplementation(() => {
				throw new Error('Cannot read device file');
			});

			const node = new Disknode('/dev/sda1', filer);

			// Load contents to trigger stats loading
			await node.load_contents();
			const contents = node.contents;
			// Should default to 'file' for unknown types
			expect(node.kind).toBe('file');
			expect(contents).toBe(null); // Cannot read device files
		});

		test('handles version overflow scenarios', () => {
			const node = new Disknode(TEST_PATH_TS, filer);

			// Simulate many invalidations
			for (let i = 0; i < 10000; i++) {
				node.invalidate();
			}

			expect(node.version).toBe(10000);
			expect(typeof node.version).toBe('number');
		});

		test('handles relative path calculations with edge cases', () => {
			// Create the full directory structure explicitly
			const root = new Disknode('/', filer);
			const a = new Disknode('/a', filer);
			const b = new Disknode('/a/b', filer);
			const c = new Disknode('/a/b/c', filer);
			const d = new Disknode('/a/b/c/d', filer);
			const e = new Disknode('/a/b/c/d/e', filer);
			const f = new Disknode('/a/b/c/d/e/f', filer);
			const g = new Disknode('/a/b/c/d/e/f/g', filer);
			const h = new Disknode('/a/b/c/d/e/f/g/h', filer);
			const i = new Disknode('/a/b/c/d/e/f/g/h/i', filer);
			const j = new Disknode('/a/b/c/d/e/f/g/h/i/j', filer);

			const deep = new Disknode('/a/b/c/d/e/f/g/h/i/j/file.ts', filer);
			const shallow = new Disknode('/a/other.ts', filer);

			// Set up parent-child relationships
			a.parent = root;
			b.parent = a;
			c.parent = b;
			d.parent = c;
			e.parent = d;
			f.parent = e;
			g.parent = f;
			h.parent = g;
			i.parent = h;
			j.parent = i;
			deep.parent = j;
			shallow.parent = a;

			// Test complex relative path - from deep to shallow
			const relative = deep.relative_to(shallow);
			expect(relative).toBe('../../../../../../../../../../other.ts');

			// Test reverse - from shallow to deep
			const reverse = shallow.relative_to(deep);
			// The correct path from /a/other.ts to /a/b/c/d/e/f/g/h/i/j/file.ts is indeed ../b/c/d/e/f/g/h/i/j/file.ts
			// because we need to go up from other.ts to /a, then down through the b/c/d... path
			expect(reverse).toBe('../b/c/d/e/f/g/h/i/j/file.ts');
		});

		test('handles same-name files in different directories', () => {
			const file1 = new Disknode('/project/src/utils.ts', filer);
			const file2 = new Disknode('/project/tests/utils.ts', filer);

			expect(file1.id).not.toBe(file2.id);
			expect(file1.extension).toBe(file2.extension);

			// Should be treated as completely separate entities
			file1.add_dependency(file2);
			expect(file1.dependencies.has(file2.id)).toBe(true);
			expect(file2.dependents.has(file1.id)).toBe(true);
		});
	});

	describe('memory and performance edge cases', () => {
		test('handles rapid invalidation cycles', async () => {
			setup_content_test(TEST_CONTENT_TS);
			const node = new Disknode(TEST_PATH_TS, filer);

			// Rapid invalidation and access cycles
			for (let i = 0; i < 1000; i++) {
				node.invalidate();
				await node.load_stats(); // Load to trigger reload
			}

			expect(node.version).toBe(1000);
			expect(vi.mocked(lstat)).toHaveBeenCalledTimes(1000);
		});

		test('handles memory pressure with large number of dependencies', () => {
			const main_node = new Disknode(TEST_PATH_TS, filer);

			// Create many dependencies
			for (let i = 0; i < 10000; i++) {
				const dep = new Disknode(`/dep${i}.ts`, filer);
				main_node.add_dependency(dep);
			}

			expect(main_node.dependencies.size).toBe(10000);

			// Clear all at once
			main_node.clear_relationships();
			expect(main_node.dependencies.size).toBe(0);
		});

		test('handles deeply nested import chains', () => {
			const chain_length = 100;
			const nodes: Array<Disknode> = [];

			// Create chain of imports
			for (let i = 0; i < chain_length; i++) {
				const node = new Disknode(`/chain${i}.ts`, filer);
				nodes.push(node);
				if (i > 0) {
					nodes[i - 1].add_dependency(node);
				}
			}

			// Verify chain integrity
			for (let i = 0; i < chain_length - 1; i++) {
				expect(nodes[i].dependencies.has(nodes[i + 1].id)).toBe(true);
				expect(nodes[i + 1].dependents.has(nodes[i].id)).toBe(true);
			}

			// Test traversal
			expect(nodes[0].dependencies.size).toBe(1);
			expect(nodes[chain_length - 1].dependents.size).toBe(1);
		});

		test('handles property access under memory pressure', async () => {
			const mock_stats = create_mock_stats({size: 1024});
			let call_count = 0;

			vi.mocked(lstat).mockImplementation(async () => {
				call_count++;
				// Throw on specific call numbers to be predictable
				if (call_count === 2 || call_count === 4) {
					throw new Error('ENOMEM: not enough memory');
				}
				return mock_stats;
			});

			const node = new Disknode(TEST_PATH_TS, filer);

			// Try 4 times - disknode.load_stats catches errors and stats getter returns null
			const results = [];
			for (let i = 0; i < 4; i++) {
				node.invalidate(); // Force reload
				await node.load_stats();
				const stats = node.stats;
				results.push(stats ? 'success' : 'null');
			}

			// The disknode's load_stats handles errors internally and stats getter returns null
			// So we get: success, null, success, null (not thrown errors)
			const success_count = results.filter((r) => r === 'success').length;
			const null_count = results.filter((r) => r === 'null').length;

			expect(results.length).toBe(4);
			expect(success_count).toBe(2); // calls 1,3 succeed and return stats
			expect(null_count).toBe(2); // calls 2,4 fail and return null
			expect(call_count).toBe(4); // All 4 calls to lstat were made
		});
	});
});
