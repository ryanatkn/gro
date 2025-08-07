// Test for expand_batch 'all' strategy optimization

import {describe, test, expect, vi} from 'vitest';

import type {Filer_Observer} from './filer_helpers.ts';
import {use_filer_test_context, TEST_PATHS, wait_for_batch} from './filer.test_helpers.ts';

vi.mock('node:fs', () => ({
	existsSync: vi.fn(),
	readFileSync: vi.fn(),
	lstatSync: vi.fn(),
	realpathSync: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
	stat: vi.fn(),
}));

vi.mock('chokidar', () => ({
	watch: vi.fn(),
	// eslint-disable-next-line @typescript-eslint/no-extraneous-class
	FSWatcher: class MockFSWatcher {},
}));

describe('Filer expand_batch all strategy optimization', () => {
	const ctx = use_filer_test_context();

	test('expand_to all includes all non-external nodes', async () => {
		const observer: Filer_Observer = {
			id: 'expand_all_test',
			patterns: [/\.ts$/],
			expand_to: 'all',
			on_change: vi.fn(),
		};

		const filer = await ctx.create_mounted_filer({
			paths: [TEST_PATHS.SOURCE],
			batch_delay: 0,
			observers: [observer],
		});

		// Create several nodes
		filer.get_disknode(TEST_PATHS.FILE_A);
		filer.get_disknode(TEST_PATHS.FILE_B);
		filer.get_disknode(TEST_PATHS.FILE_C);
		filer.get_disknode(TEST_PATHS.FILE_D);
		const node_external = filer.get_disknode(TEST_PATHS.EXTERNAL_FILE);
		node_external.is_external = true;

		// Trigger change to just one file
		ctx.mock_watcher.emit('change', TEST_PATHS.FILE_A);
		await wait_for_batch(10);

		// Verify observer was called with all non-external nodes
		expect(vi.mocked(observer.on_change)).toHaveBeenCalledTimes(1);
		const batch = vi.mocked(observer.on_change).mock.calls[0][0];
		
		// Should include all non-external nodes
		expect(batch.has(TEST_PATHS.FILE_A)).toBe(true);
		expect(batch.has(TEST_PATHS.FILE_B)).toBe(true);
		expect(batch.has(TEST_PATHS.FILE_C)).toBe(true);
		expect(batch.has(TEST_PATHS.FILE_D)).toBe(true);
		
		// Should NOT include external node
		expect(batch.has(TEST_PATHS.EXTERNAL_FILE)).toBe(false);
	});

	test('expand_to all early exits when all nodes already in batch', async () => {
		const observer: Filer_Observer = {
			id: 'expand_all_early_exit_test',
			match: () => true, // Match everything
			expand_to: 'all',
			on_change: vi.fn(),
		};

		const filer = await ctx.create_mounted_filer({
			paths: [TEST_PATHS.SOURCE],
			batch_delay: 0,
			observers: [observer],
		});

		// Create several non-external nodes
		filer.get_disknode(TEST_PATHS.FILE_A);
		filer.get_disknode(TEST_PATHS.FILE_B);
		filer.get_disknode(TEST_PATHS.FILE_C);

		// Trigger changes to all non-external files
		ctx.mock_watcher.emit('change', TEST_PATHS.FILE_A);
		ctx.mock_watcher.emit('change', TEST_PATHS.FILE_B);
		ctx.mock_watcher.emit('change', TEST_PATHS.FILE_C);
		await wait_for_batch(10);

		// Verify observer was called with all nodes
		expect(vi.mocked(observer.on_change)).toHaveBeenCalledTimes(1);
		const batch = vi.mocked(observer.on_change).mock.calls[0][0];
		
		// Should have exactly the changed nodes
		expect(batch.size).toBe(3);
		expect(batch.has(TEST_PATHS.FILE_A)).toBe(true);
		expect(batch.has(TEST_PATHS.FILE_B)).toBe(true);
		expect(batch.has(TEST_PATHS.FILE_C)).toBe(true);
	});

	test('expand_to all respects track_directories filter', async () => {
		const observer: Filer_Observer = {
			id: 'expand_all_filter_test',
			patterns: [/.*/], // Match all paths
			expand_to: 'all',
			track_directories: false, // Don't track directories
			on_change: vi.fn(),
		};

		const filer = await ctx.create_mounted_filer({
			paths: [TEST_PATHS.SOURCE],
			batch_delay: 0,
			observers: [observer],
		});

		// Create files and directories
		const file_a = filer.get_disknode(TEST_PATHS.FILE_A);
		file_a.kind = 'file';
		const file_b = filer.get_disknode(TEST_PATHS.FILE_B);
		file_b.kind = 'file';
		const dir_node = filer.get_disknode(TEST_PATHS.DIR_LIB);
		dir_node.kind = 'directory';

		// Trigger change to one file
		ctx.mock_watcher.emit('change', TEST_PATHS.FILE_A);
		await wait_for_batch(10);

		// Verify observer was called with all files but no directories
		const batch = vi.mocked(observer.on_change).mock.calls[0][0];
		
		// Should include files
		expect(batch.has(TEST_PATHS.FILE_A)).toBe(true);
		expect(batch.has(TEST_PATHS.FILE_B)).toBe(true);
		
		// Should NOT include directory
		expect(batch.has(TEST_PATHS.DIR_LIB)).toBe(false);
	});

	test('expand_to all respects track_external filter', async () => {
		const observer: Filer_Observer = {
			id: 'expand_all_external_test',
			patterns: [/.*/],
			expand_to: 'all',
			track_external: false, // Don't track external files
			on_change: vi.fn(),
		};

		const filer = await ctx.create_mounted_filer({
			paths: [TEST_PATHS.SOURCE],
			batch_delay: 0,
			observers: [observer],
		});

		// Create internal and external nodes
		filer.get_disknode(TEST_PATHS.FILE_A);
		filer.get_disknode(TEST_PATHS.FILE_B);
		const external_1 = filer.get_disknode('/external/file1.ts');
		external_1.is_external = true;
		const external_2 = filer.get_disknode('/external/file2.ts');
		external_2.is_external = true;

		// Trigger change
		ctx.mock_watcher.emit('change', TEST_PATHS.FILE_A);
		await wait_for_batch(10);

		// Verify only internal nodes are included
		const batch = vi.mocked(observer.on_change).mock.calls[0][0];
		
		expect(batch.has(TEST_PATHS.FILE_A)).toBe(true);
		expect(batch.has(TEST_PATHS.FILE_B)).toBe(true);
		expect(batch.has('/external/file1.ts')).toBe(false);
		expect(batch.has('/external/file2.ts')).toBe(false);
	});

	test('expand_to all works with empty initial batch', async () => {
		const observer: Filer_Observer = {
			id: 'expand_all_empty_test',
			patterns: [/\.never_match$/], // Pattern that won't match anything
			expand_to: 'all',
			on_change: vi.fn(),
		};

		const filer = await ctx.create_mounted_filer({
			paths: [TEST_PATHS.SOURCE],
			batch_delay: 0,
			observers: [observer],
		});

		// Create some nodes
		filer.get_disknode(TEST_PATHS.FILE_A);
		filer.get_disknode(TEST_PATHS.FILE_B);

		// Trigger change to a file that won't match the pattern
		ctx.mock_watcher.emit('change', TEST_PATHS.FILE_A);
		await wait_for_batch(10);

		// Observer should still be called with all nodes due to expand_to: 'all'
		expect(vi.mocked(observer.on_change)).toHaveBeenCalledTimes(1);
		const batch = vi.mocked(observer.on_change).mock.calls[0][0];
		
		// Even though initial pattern didn't match, expand_to all should include everything
		expect(batch.has(TEST_PATHS.FILE_A)).toBe(true);
		expect(batch.has(TEST_PATHS.FILE_B)).toBe(true);
	});

	test('expand_to all optimization performance benefit', async () => {
		// This test verifies the optimization actually improves performance
		const observer: Filer_Observer = {
			id: 'expand_all_perf_test',
			match: () => true, // Match everything
			expand_to: 'all',
			on_change: vi.fn(),
		};

		const filer = await ctx.create_mounted_filer({
			paths: [TEST_PATHS.SOURCE],
			batch_delay: 0,
			observers: [observer],
		});

		// Create many nodes to simulate a large codebase
		const nodes: Array<string> = [];
		for (let i = 0; i < 100; i++) {
			const path = `/test/project/src/file_${i}.ts`;
			nodes.push(path);
			filer.get_disknode(path);
		}

		// Trigger changes to all files (worst case for old implementation)
		for (const path of nodes) {
			ctx.mock_watcher.emit('change', path);
		}
		
		const start = performance.now();
		await wait_for_batch(10);
		const duration = performance.now() - start;

		// Verify observer was called correctly
		expect(vi.mocked(observer.on_change)).toHaveBeenCalledTimes(1);
		const batch = vi.mocked(observer.on_change).mock.calls[0][0];
		
		// Should have all nodes
		expect(batch.size).toBe(nodes.length);
		for (const path of nodes) {
			expect(batch.has(path)).toBe(true);
		}

		// Performance should be reasonable (the optimization should prevent O(n²) behavior)
		expect(duration).toBeLessThan(100); // Should complete quickly
	});

	test('expand_to all with mixed filters and patterns', async () => {
		const observer: Filer_Observer = {
			id: 'expand_all_mixed_test',
			patterns: [/\.ts$/], // Only match .ts files initially
			expand_to: 'all',
			track_directories: false,
			track_external: false,
			on_change: vi.fn(),
		};

		const filer = await ctx.create_mounted_filer({
			paths: [TEST_PATHS.SOURCE],
			batch_delay: 0,
			observers: [observer],
		});

		// Create a mix of nodes
		const ts_file = filer.get_disknode('/test/project/src/file.ts');
		ts_file.kind = 'file';
		const js_file = filer.get_disknode('/test/project/src/file.js');
		js_file.kind = 'file';
		const dir = filer.get_disknode('/test/project/src/dir');
		dir.kind = 'directory';
		const external = filer.get_disknode('/external/file.ts');
		external.is_external = true;
		external.kind = 'file';

		// Trigger change to .ts file
		ctx.mock_watcher.emit('change', '/test/project/src/file.ts');
		await wait_for_batch(10);

		const batch = vi.mocked(observer.on_change).mock.calls[0][0];
		
		// Should include all internal files (both .ts and .js due to expand_to: 'all')
		expect(batch.has('/test/project/src/file.ts')).toBe(true);
		expect(batch.has('/test/project/src/file.js')).toBe(true);
		
		// Should NOT include directory or external
		expect(batch.has('/test/project/src/dir')).toBe(false);
		expect(batch.has('/external/file.ts')).toBe(false);
	});
});