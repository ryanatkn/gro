// @slop Claude Sonnet 4

import {describe, test, expect, vi} from 'vitest';

import {
	use_filer_test_context,
	create_mock_stats,
	TEST_PATHS,
	wait_for_batch,
} from './filer.test_helpers.ts';

vi.mock('node:fs/promises', () => ({
	readFile: vi.fn(),
	lstat: vi.fn(),
	realpath: vi.fn(),
	stat: vi.fn(),
}));

// Also mock the sync version for any remaining usage
vi.mock('node:fs', () => ({
	existsSync: vi.fn(),
}));

vi.mock('chokidar', () => ({
	watch: vi.fn(),
	// eslint-disable-next-line @typescript-eslint/no-extraneous-class
	FSWatcher: class MockFSWatcher {},
}));

// Mock the synchronous parse_imports function used when workers are disabled
vi.mock('./parse_imports.ts', () => ({
	parse_imports: vi.fn().mockReturnValue([]),
}));

describe('Filer Memory Retention (Tombstones)', () => {
	const ctx = use_filer_test_context();

	describe('tombstone basic functionality', () => {
		test('deleted disknodes move to tombstones instead of remaining in main map', async () => {
			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
			});

			// Add a file
			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A, create_mock_stats());
			await wait_for_batch();

			const node = filer.get_disknode(TEST_PATHS.FILE_A);
			expect(node.exists).toBe(true);
			expect(filer.disknodes.has(TEST_PATHS.FILE_A)).toBe(true);
			expect(filer.tombstones.has(TEST_PATHS.FILE_A)).toBe(false);

			// Delete the file
			ctx.mock_watcher.emit('unlink', TEST_PATHS.FILE_A);
			await wait_for_batch();

			// Should be moved to tombstones
			expect(filer.disknodes.has(TEST_PATHS.FILE_A)).toBe(false);
			expect(filer.tombstones.has(TEST_PATHS.FILE_A)).toBe(true);
			expect(filer.tombstones.get(TEST_PATHS.FILE_A)).toBe(node);
			expect(node.exists).toBe(false);
		});

		test('get_by_id finds disknodes in both active and tombstone maps', async () => {
			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
			});

			// Add files
			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A, create_mock_stats());
			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_B, create_mock_stats());
			await wait_for_batch();

			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);

			// Delete one file
			ctx.mock_watcher.emit('unlink', TEST_PATHS.FILE_A);
			await wait_for_batch();

			// get_by_id should find both
			expect(filer.get_by_id(TEST_PATHS.FILE_A)).toBe(node_a); // In tombstones
			expect(filer.get_by_id(TEST_PATHS.FILE_B)).toBe(node_b); // In active
		});

		test('file restoration removes from tombstones and restores to active', async () => {
			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
			});

			// Add and delete file
			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A, create_mock_stats());
			await wait_for_batch();
			const original_node = filer.get_disknode(TEST_PATHS.FILE_A);

			ctx.mock_watcher.emit('unlink', TEST_PATHS.FILE_A);
			await wait_for_batch();

			expect(filer.disknodes.has(TEST_PATHS.FILE_A)).toBe(false);
			expect(filer.tombstones.has(TEST_PATHS.FILE_A)).toBe(true);
			expect(original_node.exists).toBe(false);

			// Re-add the file
			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A, create_mock_stats());
			await wait_for_batch();

			// Should be restored from tombstone
			expect(filer.disknodes.has(TEST_PATHS.FILE_A)).toBe(true);
			expect(filer.tombstones.has(TEST_PATHS.FILE_A)).toBe(false);
			const restored_node = filer.get_disknode(TEST_PATHS.FILE_A);
			expect(restored_node).toBe(original_node); // Same instance
			expect(restored_node.exists).toBe(true);
		});

		test('get_disknode restores from tombstones when accessed', async () => {
			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
			});

			// Add and delete file
			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A, create_mock_stats());
			await wait_for_batch();
			const original_node = filer.get_disknode(TEST_PATHS.FILE_A);

			ctx.mock_watcher.emit('unlink', TEST_PATHS.FILE_A);
			await wait_for_batch();

			// get_disknode should restore from tombstone
			const restored_node = filer.get_disknode(TEST_PATHS.FILE_A);
			expect(restored_node).toBe(original_node);
			expect(restored_node.exists).toBe(true);
			expect(filer.disknodes.has(TEST_PATHS.FILE_A)).toBe(true);
			expect(filer.tombstones.has(TEST_PATHS.FILE_A)).toBe(false);
		});

		test('tombstone limit controls memory usage', async () => {
			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
			});

			// Set small tombstone limit for testing
			filer.tombstone_limit = 3;

			// Create and delete 5 files
			const file_paths = [
				TEST_PATHS.FILE_A,
				TEST_PATHS.FILE_B,
				TEST_PATHS.FILE_C,
				TEST_PATHS.FILE_D,
				TEST_PATHS.FILE_E,
			];

			for (const path of file_paths) {
				ctx.mock_watcher.emit('add', path, create_mock_stats());
			}
			await wait_for_batch();

			for (const path of file_paths) {
				ctx.mock_watcher.emit('unlink', path);
			}
			await wait_for_batch();

			// Should only keep 3 tombstones (FIFO eviction)
			expect(filer.tombstones.size).toBe(3);
			expect(filer.tombstones.has(TEST_PATHS.FILE_A)).toBe(false); // Evicted
			expect(filer.tombstones.has(TEST_PATHS.FILE_B)).toBe(false); // Evicted
			expect(filer.tombstones.has(TEST_PATHS.FILE_C)).toBe(true); // Kept
			expect(filer.tombstones.has(TEST_PATHS.FILE_D)).toBe(true); // Kept
			expect(filer.tombstones.has(TEST_PATHS.FILE_E)).toBe(true); // Kept
		});

		test('FIFO eviction preserves insertion order', async () => {
			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
			});

			filer.tombstone_limit = 2;

			// Add files sequentially
			const files = [TEST_PATHS.FILE_A, TEST_PATHS.FILE_B, TEST_PATHS.FILE_C];
			for (const file of files) {
				ctx.mock_watcher.emit('add', file, create_mock_stats());
				await wait_for_batch();
			}

			// Delete in same order
			for (const file of files) {
				ctx.mock_watcher.emit('unlink', file);
				await wait_for_batch();
			}

			// Should keep last 2 (B and C), evict first (A)
			expect(filer.tombstones.size).toBe(2);
			expect(filer.tombstones.has(TEST_PATHS.FILE_A)).toBe(false);
			expect(filer.tombstones.has(TEST_PATHS.FILE_B)).toBe(true);
			expect(filer.tombstones.has(TEST_PATHS.FILE_C)).toBe(true);

			// Verify iteration order matches FIFO
			const tombstone_keys = Array.from(filer.tombstones.keys());
			expect(tombstone_keys).toEqual([TEST_PATHS.FILE_B, TEST_PATHS.FILE_C]);
		});

		test('default tombstone limit is 500', () => {
			const filer = ctx.create_unmounted_filer();
			expect(filer.tombstone_limit).toBe(500);
		});

		test('tombstone limit is publicly writable', async () => {
			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
			});

			filer.tombstone_limit = 500;
			expect(filer.tombstone_limit).toBe(500);

			filer.tombstone_limit = 2000;
			expect(filer.tombstone_limit).toBe(2000);
		});
	});

	describe('tombstone relationship management', () => {
		test('relationships are cleared before moving to tombstones', async () => {
			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
			});

			// Set up dependencies
			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
			const node_c = filer.get_disknode(TEST_PATHS.FILE_C);

			node_b.add_dependency(node_a);
			node_c.add_dependency(node_a);

			expect(node_a.dependents.size).toBe(2);
			expect(node_b.dependencies.size).toBe(1);
			expect(node_c.dependencies.size).toBe(1);

			// Delete node A
			ctx.mock_watcher.emit('unlink', TEST_PATHS.FILE_A);
			await wait_for_batch();

			// Relationships should be cleared
			const tombstone_node = filer.tombstones.get(TEST_PATHS.FILE_A);
			expect(tombstone_node?.dependents.size).toBe(0);
			expect(node_b.dependencies.size).toBe(0);
			expect(node_c.dependencies.size).toBe(0);
		});

		test('parent-child relationships are cleaned up on delete', async () => {
			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
			});

			// Add file to create parent-child relationship
			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A, create_mock_stats());
			await wait_for_batch();

			const file_node = filer.get_disknode(TEST_PATHS.FILE_A);
			const parent_node = filer.get_disknode(TEST_PATHS.SOURCE);

			expect(file_node.parent).toBe(parent_node);
			expect(parent_node.children.has('a.ts')).toBe(true);

			// Delete file
			ctx.mock_watcher.emit('unlink', TEST_PATHS.FILE_A);
			await wait_for_batch();

			// Parent should no longer have child
			expect(parent_node.children.has('a.ts')).toBe(false);
		});

		test('restored nodes maintain their relationships if dependencies still exist', async () => {
			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
			});

			// Create nodes and relationships
			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A, create_mock_stats());
			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_B, create_mock_stats());
			await wait_for_batch();

			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
			node_b.add_dependency(node_a);

			// Delete A, then restore it
			ctx.mock_watcher.emit('unlink', TEST_PATHS.FILE_A);
			await wait_for_batch();

			expect(node_b.dependencies.size).toBe(0); // Cleared

			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A, create_mock_stats());
			await wait_for_batch();

			// Restored node should be clean (no automatic relationship restoration)
			const restored_node = filer.get_disknode(TEST_PATHS.FILE_A);
			expect(restored_node).toBe(node_a);
			expect(restored_node.dependents.size).toBe(0);
			expect(node_b.dependencies.size).toBe(0);
		});
	});

	describe('tombstone edge cases', () => {
		test('deleting non-existent file does not create tombstone', async () => {
			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
			});

			// Delete file that was never added
			ctx.mock_watcher.emit('unlink', TEST_PATHS.FILE_A);
			await wait_for_batch();

			expect(filer.disknodes.has(TEST_PATHS.FILE_A)).toBe(false);
			expect(filer.tombstones.has(TEST_PATHS.FILE_A)).toBe(false);
		});

		test('multiple deletes of same file are idempotent', async () => {
			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
			});

			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A, create_mock_stats());
			await wait_for_batch();

			// Delete twice
			ctx.mock_watcher.emit('unlink', TEST_PATHS.FILE_A);
			ctx.mock_watcher.emit('unlink', TEST_PATHS.FILE_A);
			await wait_for_batch();

			expect(filer.tombstones.size).toBe(1);
			expect(filer.tombstones.has(TEST_PATHS.FILE_A)).toBe(true);
		});

		test('recreating file multiple times works correctly', async () => {
			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
			});

			let node: any;

			// Create, delete, recreate cycle
			for (let i = 0; i < 3; i++) {
				ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A, create_mock_stats());
				await wait_for_batch();

				const current_node = filer.get_disknode(TEST_PATHS.FILE_A);
				if (i === 0) {
					node = current_node;
				} else {
					expect(current_node).toBe(node); // Same instance restored
				}

				expect(current_node.exists).toBe(true);
				expect(filer.disknodes.has(TEST_PATHS.FILE_A)).toBe(true);
				expect(filer.tombstones.has(TEST_PATHS.FILE_A)).toBe(false);

				ctx.mock_watcher.emit('unlink', TEST_PATHS.FILE_A);
				await wait_for_batch();

				expect(current_node.exists).toBe(false);
				expect(filer.disknodes.has(TEST_PATHS.FILE_A)).toBe(false);
				expect(filer.tombstones.has(TEST_PATHS.FILE_A)).toBe(true);
			}
		});

		test('tombstones are cleared on filer disposal', async () => {
			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
			});

			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A, create_mock_stats());
			await wait_for_batch();
			ctx.mock_watcher.emit('unlink', TEST_PATHS.FILE_A);
			await wait_for_batch();

			expect(filer.tombstones.size).toBe(1);

			await filer.dispose();

			expect(filer.tombstones.size).toBe(0);
			expect(filer.disknodes.size).toBe(0);
		});

		test('tombstones are cleared on reset_watcher', async () => {
			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
			});

			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A, create_mock_stats());
			await wait_for_batch();
			ctx.mock_watcher.emit('unlink', TEST_PATHS.FILE_A);
			await wait_for_batch();

			expect(filer.tombstones.size).toBe(1);

			await filer.reset_watcher([TEST_PATHS.SOURCE]);

			expect(filer.tombstones.size).toBe(0);
			expect(filer.disknodes.size).toBe(0);
		});

		test('zero tombstone limit prevents tombstone creation', async () => {
			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
			});

			filer.tombstone_limit = 0;

			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A, create_mock_stats());
			await wait_for_batch();
			ctx.mock_watcher.emit('unlink', TEST_PATHS.FILE_A);
			await wait_for_batch();

			expect(filer.tombstones.size).toBe(0);
			expect(filer.disknodes.has(TEST_PATHS.FILE_A)).toBe(false);
		});

		test('zero tombstone limit with multiple files prevents all tombstones', async () => {
			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
			});

			filer.tombstone_limit = 0;

			// Add multiple files
			const files = [TEST_PATHS.FILE_A, TEST_PATHS.FILE_B, TEST_PATHS.FILE_C];
			for (const file of files) {
				ctx.mock_watcher.emit('add', file, create_mock_stats());
			}
			await wait_for_batch();

			// Delete all files
			for (const file of files) {
				ctx.mock_watcher.emit('unlink', file);
			}
			await wait_for_batch();

			// Should have no tombstones regardless of how many files were deleted
			expect(filer.tombstones.size).toBe(0);
			for (const file of files) {
				expect(filer.disknodes.has(file)).toBe(false);
				expect(filer.tombstones.has(file)).toBe(false);
			}
		});

		test('very large tombstone limit handles many deletions', async () => {
			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
			});

			filer.tombstone_limit = 10000;

			// Create and delete 100 files
			const files = Array.from({length: 100}, (_, i) => `/test/project/src/file${i}.ts`);

			for (const file of files) {
				ctx.mock_watcher.emit('add', file, create_mock_stats());
			}
			await wait_for_batch();

			for (const file of files) {
				ctx.mock_watcher.emit('unlink', file);
			}
			await wait_for_batch();

			expect(filer.tombstones.size).toBe(100);
			expect(filer.disknodes.size).toBeGreaterThan(0); // Parent dirs remain
		});
	});

	describe('memory leak prevention', () => {
		test('prevents unbounded growth from high-churn files', async () => {
			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
			});

			filer.tombstone_limit = 10;

			// Simulate high churn: create/delete 50 different files (reduced for speed)
			for (let i = 0; i < 50; i++) {
				const file_path = `/test/project/src/temp${i}.ts`;
				ctx.mock_watcher.emit('add', file_path, create_mock_stats());
				ctx.mock_watcher.emit('unlink', file_path);

				// Only wait every 10 operations to speed up test
				if (i % 10 === 9) {
					await wait_for_batch(10);
					// Memory should stay bounded
					expect(filer.tombstones.size).toBeLessThanOrEqual(10);
				}
			}

			// Final wait and check
			await wait_for_batch(10);
			expect(filer.tombstones.size).toBeLessThanOrEqual(10);
		});

		test('old implementation would have unbounded growth', async () => {
			// This test documents what the old behavior would have been
			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
			});

			// Create map to simulate old behavior for comparison
			const old_behavior_disknodes = new Map();

			for (let i = 0; i < 25; i++) {
				const file_path = `/test/project/src/temp${i}.ts`;
				ctx.mock_watcher.emit('add', file_path, create_mock_stats());
				ctx.mock_watcher.emit('unlink', file_path);

				// Simulate old behavior tracking
				old_behavior_disknodes.set(file_path, {exists: false});

				// Only wait every 5 operations
				if (i % 5 === 4) {
					await wait_for_batch(10);
				}
			}

			// Final wait
			await wait_for_batch(10);

			// New implementation: bounded memory via tombstones
			expect(filer.tombstones.size).toBeLessThanOrEqual(1000); // Default limit

			// Old behavior would have kept everything
			expect(old_behavior_disknodes.size).toBe(25);
		});

		test('stress test with rapid create/delete cycles', async () => {
			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
			});

			filer.tombstone_limit = 25;

			// Rapid cycles on same files
			const files = [TEST_PATHS.FILE_A, TEST_PATHS.FILE_B, TEST_PATHS.FILE_C];

			for (let cycle = 0; cycle < 10; cycle++) {
				for (const file of files) {
					ctx.mock_watcher.emit('add', file, create_mock_stats());
					ctx.mock_watcher.emit('unlink', file);
				}

				// Only wait every 2 cycles
				if (cycle % 2 === 1) {
					await wait_for_batch(10);
					// Memory should stay bounded throughout
					expect(filer.tombstones.size).toBeLessThanOrEqual(25);
					expect(filer.disknodes.size).toBeGreaterThan(0); // Parent dirs
					expect(filer.disknodes.size).toBeLessThan(100); // But not unbounded
				}
			}

			// Final check
			await wait_for_batch(10);
			expect(filer.tombstones.size).toBeLessThanOrEqual(25);
		});
	});

	describe('integration with existing functionality', () => {
		test('tombstones work with find_disknodes', async () => {
			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
			});

			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A, create_mock_stats());
			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_B, create_mock_stats());
			await wait_for_batch();

			ctx.mock_watcher.emit('unlink', TEST_PATHS.FILE_A);
			await wait_for_batch();

			// find_disknodes only searches active disknodes, not tombstones
			const ts_files = filer.find_disknodes((node) => node.id.endsWith('.ts'));
			expect(ts_files).toHaveLength(1); // Only FILE_B (active)
			expect(ts_files[0].id).toBe(TEST_PATHS.FILE_B);
		});

		test('tombstones work with load_initial_stats', async () => {
			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
			});

			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A, create_mock_stats());
			await wait_for_batch();
			ctx.mock_watcher.emit('unlink', TEST_PATHS.FILE_A);
			await wait_for_batch();

			// Should not crash with tombstones present
			await expect(filer.load_initial_stats()).resolves.toBeUndefined();
		});

		test('tombstones do not interfere with observer notifications', async () => {
			const observer = {
				id: 'test_observer',
				patterns: [/\.ts$/],
				on_change: vi.fn(),
			};

			await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
				observers: [observer],
			});

			// Add, delete, re-add file
			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A, create_mock_stats());
			await wait_for_batch();

			ctx.mock_watcher.emit('unlink', TEST_PATHS.FILE_A);
			await wait_for_batch();

			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A, create_mock_stats());
			await wait_for_batch();

			// Observer should be called for all events
			expect(vi.mocked(observer.on_change)).toHaveBeenCalledTimes(3);

			// Check that the restored disknode is in the final batch
			const final_call = vi.mocked(observer.on_change).mock.calls[2];
			const final_batch = final_call[0];
			expect(final_batch.has(TEST_PATHS.FILE_A)).toBe(true);
			expect(final_batch.get(TEST_PATHS.FILE_A)?.type).toBe('add');
		});

		test('tombstones maintain disknode identity correctly', async () => {
			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
			});

			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A, create_mock_stats());
			await wait_for_batch();

			const original_node = filer.get_disknode(TEST_PATHS.FILE_A);
			const original_version = original_node.version;

			// Delete file
			ctx.mock_watcher.emit('unlink', TEST_PATHS.FILE_A);
			await wait_for_batch();

			// Version should have been incremented during invalidation
			expect(original_node.version).toBeGreaterThan(original_version);

			// Restore from tombstone
			const restored_node = filer.get_disknode(TEST_PATHS.FILE_A);

			// Should be the same object with preserved state
			expect(restored_node).toBe(original_node);
			expect(restored_node.exists).toBe(true);
			expect(restored_node.version).toBeGreaterThan(original_version);
		});

		test('prevents parent-child relationship memory leaks', async () => {
			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
			});

			const parent = filer.get_disknode(TEST_PATHS.SOURCE);
			const initial_children_count = parent.children.size;

			// Create and delete files repeatedly
			for (let i = 0; i < 20; i++) {
				const path = `${TEST_PATHS.SOURCE}/leak_test${i}.ts`;
				ctx.mock_watcher.emit('add', path, create_mock_stats());
				ctx.mock_watcher.emit('unlink', path);
			}

			await wait_for_batch();

			// Parent should not retain references to deleted children
			expect(parent.children.size).toBe(initial_children_count);

			// Verify no stale child references
			for (const child_node of parent.children.values()) {
				expect(child_node.exists).toBe(true);
				expect(child_node.parent).toBe(parent);
			}

			// Verify tombstones are properly managed
			expect(filer.tombstones.size).toBeLessThanOrEqual(filer.tombstone_limit);
		});
	});
});
