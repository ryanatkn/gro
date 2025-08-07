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
const TEST_PATH_TS: Path_Id = TEST_PATHS.FILE_A;
const TEST_PATH_JS: Path_Id = TEST_PATHS.FILE_JS;
const TEST_CONTENT_TS = 'export const value = 1;';

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

const setup_content_test = (content: string, size = 100) => {
	const mock_stats = create_mock_stats({size});
	vi.mocked(lstatSync).mockReturnValue(mock_stats);
	vi.mocked(readFileSync).mockReturnValue(content);
	return mock_stats;
};

const setup_import_test = (
	filer: Filer,
	content: string,
	imports: Array<string>,
	dependencies: Record<string, Path_Id> = {},
) => {
	setup_content_test(content);
	vi.mocked(filer.parse_imports).mockReturnValue(imports);

	vi.mocked(filer.get_disknode).mockImplementation((id: Path_Id) => {
		for (const dep_path of Object.values(dependencies)) {
			if (id === dep_path) {
				return new Disknode(dep_path, filer);
			}
		}
		return new Disknode(id, filer);
	});
};

describe('Disknode Version Tracking', () => {
	let filer: Filer;

	beforeEach(() => {
		filer = create_mock_filer();
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('version tracking', () => {
		test('starts with version 0', () => {
			const disknode = new Disknode(TEST_PATH_TS, filer);
			expect(disknode.version).toBe(0);
		});

		test('tracks version for each property', () => {
			setup_content_test(TEST_CONTENT_TS);
			vi.mocked(realpathSync).mockReturnValue(TEST_PATH_TS);
			const disknode = new Disknode(TEST_PATH_TS, filer);

			expect(disknode.stats_version).toBe(-1);
			expect(disknode.contents_version).toBe(-1);
			expect(disknode.realpath_version).toBe(-1);
			expect(disknode.imports_version).toBe(-1);

			// Access properties to update versions
			disknode.stats;
			disknode.contents;
			disknode.realpath;
			disknode.imports;

			expect(disknode.stats_version).toBe(0);
			expect(disknode.contents_version).toBe(0);
			expect(disknode.realpath_version).toBe(0);
			expect(disknode.imports_version).toBe(0);
		});

		test('increments version on invalidation', () => {
			const disknode = new Disknode(TEST_PATH_TS, filer);
			expect(disknode.version).toBe(0);

			disknode.invalidate();
			expect(disknode.version).toBe(1);

			disknode.invalidate();
			expect(disknode.version).toBe(2);
		});

		test('version controls cache invalidation for stats', () => {
			const mock_stats_1 = create_mock_stats({size: 100});
			const mock_stats_2 = create_mock_stats({size: 200});
			vi.mocked(lstatSync).mockReturnValueOnce(mock_stats_1).mockReturnValueOnce(mock_stats_2);

			const disknode = new Disknode(TEST_PATH_TS, filer);

			// First access
			const stats1 = disknode.stats;
			expect(stats1).toBe(mock_stats_1);
			expect(disknode.stats_version).toBe(0);

			// Second access without invalidation - should use cache
			const stats2 = disknode.stats;
			expect(stats2).toBe(mock_stats_1);
			expect(vi.mocked(lstatSync)).toHaveBeenCalledTimes(1);

			// Invalidate and access again
			disknode.invalidate();
			expect(disknode.version).toBe(1);
			expect(disknode.stats_version).toBe(0); // Still old version

			const stats3 = disknode.stats;
			expect(stats3).toBe(mock_stats_2);
			expect(disknode.stats_version).toBe(1);
			expect(vi.mocked(lstatSync)).toHaveBeenCalledTimes(2);
		});

		test('version controls cache invalidation for contents', () => {
			const content1 = 'export const a = 1;';
			const content2 = 'export const b = 2;';

			setup_content_test(content1);
			const disknode = new Disknode(TEST_PATH_TS, filer);

			// First access
			const contents1 = disknode.contents;
			expect(contents1).toBe(content1);
			expect(disknode.contents_version).toBe(0);

			// Second access without invalidation - should use cache
			const contents2 = disknode.contents;
			expect(contents2).toBe(content1);
			expect(vi.mocked(readFileSync)).toHaveBeenCalledTimes(1);

			// Invalidate and change mock return value
			vi.mocked(readFileSync).mockReturnValue(content2);
			disknode.invalidate();

			const contents3 = disknode.contents;
			expect(contents3).toBe(content2);
			expect(disknode.contents_version).toBe(1);
			expect(vi.mocked(readFileSync)).toHaveBeenCalledTimes(2);
		});

		test('version controls cache invalidation for realpath', () => {
			const realpath1 = '/resolved/path1.ts';
			const realpath2 = '/resolved/path2.ts';

			// Setup symlink stats
			const symlink_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => false,
				isSymbolicLink: () => true,
			});
			vi.mocked(lstatSync).mockReturnValue(symlink_stats);
			vi.mocked(realpathSync).mockReturnValueOnce(realpath1).mockReturnValueOnce(realpath2);

			const disknode = new Disknode('/test/symlink', filer);

			// First access
			const resolved1 = disknode.realpath;
			expect(resolved1).toBe(realpath1);
			expect(disknode.realpath_version).toBe(0);

			// Second access without invalidation - should use cache
			const resolved2 = disknode.realpath;
			expect(resolved2).toBe(realpath1);
			expect(vi.mocked(realpathSync)).toHaveBeenCalledTimes(1);

			// Invalidate and access again
			disknode.invalidate();
			const resolved3 = disknode.realpath;
			expect(resolved3).toBe(realpath2);
			expect(disknode.realpath_version).toBe(1);
			expect(vi.mocked(realpathSync)).toHaveBeenCalledTimes(2);
		});

		test('version controls cache invalidation for imports', () => {
			const imports1 = ['./module1.js'];
			const imports2 = ['./module1.js', './module2.js'];

			// Setup first call
			setup_import_test(filer, TEST_CONTENT_TS, imports1);
			const disknode = new Disknode(TEST_PATH_TS, filer);

			// First access
			const result1 = disknode.imports;
			expect(result1?.has('./module1.js')).toBe(true);
			expect(result1?.size).toBe(1);
			expect(disknode.imports_version).toBe(0);

			// Second access without invalidation - should use cache
			const result2 = disknode.imports;
			expect(result2).toBe(result1);
			expect(vi.mocked(filer.parse_imports)).toHaveBeenCalledTimes(1);

			// Invalidate and change imports
			vi.mocked(filer.parse_imports).mockReturnValue(imports2);
			disknode.invalidate();

			const result3 = disknode.imports;
			expect(result3?.has('./module1.js')).toBe(true);
			expect(result3?.has('./module2.js')).toBe(true);
			expect(result3?.size).toBe(2);
			expect(disknode.imports_version).toBe(1);
			expect(vi.mocked(filer.parse_imports)).toHaveBeenCalledTimes(2);
		});

		test('version tracking is independent across instances', () => {
			const disknode1 = new Disknode(TEST_PATH_TS, filer);
			const disknode2 = new Disknode(TEST_PATH_JS, filer);

			expect(disknode1.version).toBe(0);
			expect(disknode2.version).toBe(0);

			disknode1.invalidate();
			expect(disknode1.version).toBe(1);
			expect(disknode2.version).toBe(0);

			disknode2.invalidate();
			disknode2.invalidate();
			expect(disknode1.version).toBe(1);
			expect(disknode2.version).toBe(2);
		});

		test('all property versions start at -1', () => {
			const disknode = new Disknode(TEST_PATH_TS, filer);
			expect(disknode.stats_version).toBe(-1);
			expect(disknode.contents_version).toBe(-1);
			expect(disknode.realpath_version).toBe(-1);
			expect(disknode.imports_version).toBe(-1);
		});

		test('property versions update with dependencies', () => {
			setup_content_test(TEST_CONTENT_TS);
			vi.mocked(realpathSync).mockReturnValue(TEST_PATH_TS);
			const disknode = new Disknode(TEST_PATH_TS, filer);

			// Access only stats
			disknode.stats;
			expect(disknode.stats_version).toBe(0);
			expect(disknode.contents_version).toBe(-1);
			expect(disknode.realpath_version).toBe(-1);
			expect(disknode.imports_version).toBe(-1);

			// Access contents (which also accesses stats internally)
			disknode.contents;
			expect(disknode.stats_version).toBe(0); // Already current from earlier access
			expect(disknode.contents_version).toBe(0);
			expect(disknode.realpath_version).toBe(-1);
			expect(disknode.imports_version).toBe(-1);

			// Invalidate and access realpath (which also accesses stats internally)
			disknode.invalidate();
			disknode.realpath;
			expect(disknode.stats_version).toBe(1); // Updated because realpath accesses stats
			expect(disknode.contents_version).toBe(0); // Old version
			expect(disknode.realpath_version).toBe(1); // New version
			expect(disknode.imports_version).toBe(-1); // Never accessed
		});

		test('version tracking with property failures', () => {
			const disknode = new Disknode(TEST_PATH_TS, filer);

			// Mock stats to fail
			vi.mocked(lstatSync).mockImplementation(() => {
				throw new Error('ENOENT');
			});

			// Access stats (will fail and return null)
			const stats = disknode.stats;
			expect(stats).toBe(null);
			expect(disknode.stats_version).toBe(0); // Version still updates even on failure
			expect(disknode.exists).toBe(false);

			// Second access should use cached failure
			const stats2 = disknode.stats;
			expect(stats2).toBe(null);
			expect(vi.mocked(lstatSync)).toHaveBeenCalledTimes(1);
		});
	});

	describe('version tracking edge cases', () => {
		test('handles rapid invalidation sequences', () => {
			const disknode = new Disknode(TEST_PATH_TS, filer);

			for (let i = 0; i < 100; i++) {
				disknode.invalidate();
			}

			expect(disknode.version).toBe(100);
		});

		test('version increments correctly with large numbers', () => {
			const disknode = new Disknode(TEST_PATH_TS, filer);

			// Test that version increments work with large numbers
			for (let i = 0; i < 1000; i++) {
				disknode.invalidate();
			}
			
			expect(disknode.version).toBe(1000);
			
			// Continue incrementing
			for (let i = 0; i < 1000; i++) {
				disknode.invalidate();
			}
			
			expect(disknode.version).toBe(2000);
		});

		test('version tracking with mixed property access patterns', () => {
			setup_content_test(TEST_CONTENT_TS);
			vi.mocked(realpathSync).mockReturnValue(TEST_PATH_TS);
			const disknode = new Disknode(TEST_PATH_TS, filer);

			// Mixed access pattern
			disknode.contents; // version 0, stats also loaded
			disknode.invalidate(); // version 1
			disknode.stats; // version 1
			disknode.invalidate(); // version 2
			disknode.realpath; // version 2, stats also reloaded to version 2
			disknode.contents; // Should reload to version 2
			disknode.imports; // version 2

			expect(disknode.version).toBe(2);
			expect(disknode.contents_version).toBe(2);
			expect(disknode.stats_version).toBe(2); // Updated by realpath access
			expect(disknode.realpath_version).toBe(2);
			expect(disknode.imports_version).toBe(2);
		});

		test('version tracking survives property getter exceptions', () => {
			const disknode = new Disknode(TEST_PATH_TS, filer);

			// Mock lstatSync to throw on first call, succeed on second
			vi.mocked(lstatSync)
				.mockImplementationOnce(() => {
					throw new Error('Temporary failure');
				})
				.mockReturnValueOnce(create_mock_stats());

			// First access fails
			const stats1 = disknode.stats;
			expect(stats1).toBe(null);
			expect(disknode.stats_version).toBe(0);

			// Invalidate and try again
			disknode.invalidate();
			const stats2 = disknode.stats;
			expect(stats2).not.toBe(null);
			expect(disknode.stats_version).toBe(1);
		});
	});
});
