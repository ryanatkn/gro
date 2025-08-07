// @slop Claude Sonnet 4

import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest';
import {lstatSync} from 'node:fs';

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

const setup_stats_test = (stats_options: Record<string, any> = {}) => {
	const mock_stats = create_mock_stats(stats_options);
	vi.mocked(lstatSync).mockReturnValue(mock_stats);
	return mock_stats;
};

describe('Disknode Stats Variants', () => {
	let filer: Filer;

	beforeEach(() => {
		filer = create_mock_filer();
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('set_stats variants', () => {
		test('set_stats skips if already current', () => {
			setup_stats_test({size: 100});
			const disknode = new Disknode(TEST_PATH_TS, filer);

			// Access stats to make them current
			disknode.stats;
			const first_call_count = vi.mocked(lstatSync).mock.calls.length;

			// set_stats should skip since version is current
			const new_stats = create_mock_stats({size: 200});
			disknode.set_stats(new_stats);

			// Should not have called lstat again
			expect(vi.mocked(lstatSync).mock.calls.length).toBe(first_call_count);
			// Stats should still be the original ones
			expect(disknode.size).toBe(100);
		});

		test('set_stats_force bypasses version check', () => {
			setup_stats_test({size: 100});
			const disknode = new Disknode(TEST_PATH_TS, filer);

			// Access stats to make them current
			disknode.stats;
			expect(disknode.size).toBe(100);

			// set_stats_force should override even if version is current
			const new_stats = create_mock_stats({size: 200});
			disknode.set_stats_force(new_stats);

			expect(disknode.size).toBe(200);
		});

		test('set_stats updates when version is outdated', () => {
			setup_stats_test({size: 100});
			const disknode = new Disknode(TEST_PATH_TS, filer);

			// Don't access stats yet, so they're outdated
			expect(disknode.stats_version).toBe(-1);

			// set_stats should work since version is outdated
			const new_stats = create_mock_stats({size: 200});
			disknode.set_stats(new_stats);

			expect(disknode.size).toBe(200);
			expect(disknode.stats_version).toBe(0);

			// Subsequent stats access should use the set stats, not call lstat
			const stats = disknode.stats;
			expect(stats).toBe(new_stats);
			expect(vi.mocked(lstatSync)).not.toHaveBeenCalled();
		});

		test('set_stats updates kind from stats', () => {
			const disknode = new Disknode(TEST_PATH_TS, filer);
			expect(disknode.kind).toBe('file'); // Default

			// Set directory stats
			const dir_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => true,
			});
			disknode.set_stats(dir_stats);

			expect(disknode.kind).toBe('directory');
			expect(disknode.exists).toBe(true);
		});

		test('set_stats updates exists flag', () => {
			const disknode = new Disknode(TEST_PATH_TS, filer);
			disknode.exists = false; // Simulate deleted state

			const stats = create_mock_stats({size: 100});
			disknode.set_stats(stats);

			expect(disknode.exists).toBe(true);
		});

		test('set_stats_force updates kind from stats', () => {
			const disknode = new Disknode(TEST_PATH_TS, filer);

			// Access stats first to make current
			setup_stats_test();
			disknode.stats;
			expect(disknode.kind).toBe('file');

			// Force set symlink stats
			const symlink_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => false,
				isSymbolicLink: () => true,
			});
			disknode.set_stats_force(symlink_stats);

			expect(disknode.kind).toBe('symlink');
			expect(disknode.exists).toBe(true);
		});

		test('set_stats_force updates exists flag', () => {
			const disknode = new Disknode(TEST_PATH_TS, filer);
			disknode.exists = false; // Simulate deleted state

			const stats = create_mock_stats({size: 100});
			disknode.set_stats_force(stats);

			expect(disknode.exists).toBe(true);
		});

		test('set_stats with different file types', () => {
			const disknode = new Disknode(TEST_PATH_TS, filer);

			// Test file stats
			const file_stats = create_mock_stats({
				isFile: () => true,
				isDirectory: () => false,
				isSymbolicLink: () => false,
			});
			disknode.set_stats(file_stats);
			expect(disknode.kind).toBe('file');

			// Test directory stats
			const dir_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => true,
				isSymbolicLink: () => false,
			});
			disknode.set_stats_force(dir_stats);
			expect(disknode.kind).toBe('directory');

			// Test symlink stats
			const symlink_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => false,
				isSymbolicLink: () => true,
			});
			disknode.set_stats_force(symlink_stats);
			expect(disknode.kind).toBe('symlink');
		});

		test('set_stats preserves stats version tracking', () => {
			const disknode = new Disknode(TEST_PATH_TS, filer);

			const stats = create_mock_stats({size: 100});
			disknode.set_stats(stats);

			expect(disknode.stats_version).toBe(disknode.version);

			// Invalidate and check that set_stats now works again
			disknode.invalidate();
			const new_stats = create_mock_stats({size: 200});
			disknode.set_stats(new_stats);

			expect(disknode.stats_version).toBe(disknode.version);
			expect(disknode.size).toBe(200);
		});

		test('set_stats_force always updates version', () => {
			const disknode = new Disknode(TEST_PATH_TS, filer);

			const stats1 = create_mock_stats({size: 100});
			disknode.set_stats_force(stats1);
			const version1 = disknode.stats_version;

			// Force set again without invalidation
			const stats2 = create_mock_stats({size: 200});
			disknode.set_stats_force(stats2);
			const version2 = disknode.stats_version;

			expect(version2).toBe(version1); // Same version since no invalidation
			expect(disknode.size).toBe(200); // But stats updated
		});

		test('set_stats interaction with lazy stats loading', () => {
			const original_stats = create_mock_stats({size: 100});
			setup_stats_test(original_stats);
			const disknode = new Disknode(TEST_PATH_TS, filer);

			// Set stats before any access
			const preset_stats = create_mock_stats({size: 200});
			disknode.set_stats(preset_stats);

			// Access stats should return preset stats, not trigger lstat
			const stats = disknode.stats;
			expect(stats).toBe(preset_stats);
			expect(vi.mocked(lstatSync)).not.toHaveBeenCalled();
		});

		test('set_stats after failed stats loading', () => {
			// Mock lstat to fail
			vi.mocked(lstatSync).mockImplementation(() => {
				throw new Error('ENOENT');
			});

			const disknode = new Disknode(TEST_PATH_TS, filer);

			// Try to access stats (will fail)
			const failed_stats = disknode.stats;
			expect(failed_stats).toBe(null);
			expect(disknode.exists).toBe(false);

			// Now set stats manually
			const good_stats = create_mock_stats({size: 100});
			disknode.set_stats_force(good_stats);

			expect(disknode.stats).toBe(good_stats);
			expect(disknode.exists).toBe(true);
			expect(disknode.size).toBe(100);
		});

		test('multiple set_stats calls with version tracking', () => {
			const disknode = new Disknode(TEST_PATH_TS, filer);

			// First set
			const stats1 = create_mock_stats({size: 100});
			disknode.set_stats(stats1);
			expect(disknode.size).toBe(100);

			// Second set without invalidation - should be skipped
			const stats2 = create_mock_stats({size: 200});
			disknode.set_stats(stats2);
			expect(disknode.size).toBe(100); // Unchanged

			// Invalidate and set again
			disknode.invalidate();
			disknode.set_stats(stats2);
			expect(disknode.size).toBe(200); // Now changed
		});

		test('set_stats vs set_stats_force behavior comparison', () => {
			setup_stats_test({size: 50});
			const disknode = new Disknode(TEST_PATH_TS, filer);

			// Access stats to make current
			disknode.stats;
			expect(disknode.size).toBe(50);

			// Try regular set_stats - should be ignored
			const stats_regular = create_mock_stats({size: 100});
			disknode.set_stats(stats_regular);
			expect(disknode.size).toBe(50); // Unchanged

			// Try force set_stats - should work
			const stats_force = create_mock_stats({size: 200});
			disknode.set_stats_force(stats_force);
			expect(disknode.size).toBe(200); // Changed
		});

		test('stats optimization check in size getter', () => {
			const disknode = new Disknode(TEST_PATH_TS, filer);

			// Set stats directly
			const stats = create_mock_stats({size: 300});
			disknode.set_stats(stats);

			// Size getter should use cached stats without calling lstat
			const size = disknode.size;
			expect(size).toBe(300);
			expect(vi.mocked(lstatSync)).not.toHaveBeenCalled();
		});

		test('stats setting with null values', () => {
			const disknode = new Disknode(TEST_PATH_TS, filer);

			// Create stats with null/undefined properties
			const partial_stats = create_mock_stats({
				size: undefined,
			}) as any; // Override type checking for test
			partial_stats.mtimeMs = null;

			disknode.set_stats_force(partial_stats);

			// Should handle gracefully - null values are preserved
			expect(disknode.size).toBeNull();
			expect(disknode.mtime).toBeNull();
		});
	});

	describe('stats getter behavior with variants', () => {
		test('stats getter respects set_stats', () => {
			const disknode = new Disknode(TEST_PATH_TS, filer);

			// Set stats without filesystem access
			const preset_stats = create_mock_stats({size: 999});
			disknode.set_stats(preset_stats);

			// Multiple accesses should return the same preset stats
			expect(disknode.stats).toBe(preset_stats);
			expect(disknode.stats).toBe(preset_stats);
			expect(vi.mocked(lstatSync)).not.toHaveBeenCalled();
		});

		test('stats getter after invalidation ignores old set_stats', () => {
			const filesystem_stats = create_mock_stats({size: 100});
			setup_stats_test(filesystem_stats);
			const disknode = new Disknode(TEST_PATH_TS, filer);

			// Set stats manually
			const manual_stats = create_mock_stats({size: 200});
			disknode.set_stats(manual_stats);
			expect(disknode.stats).toBe(manual_stats);

			// Clear mock call history
			vi.mocked(lstatSync).mockClear();

			// Invalidate
			disknode.invalidate();

			// Next stats access should go to filesystem
			const fresh_stats = disknode.stats;
			expect(fresh_stats).toEqual(filesystem_stats); // Use toEqual for content comparison
			expect(vi.mocked(lstatSync)).toHaveBeenCalledTimes(1);
		});
	});
});
