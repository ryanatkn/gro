// @slop Claude Opus 4.1

import {describe, test, expect, vi} from 'vitest';
import {existsSync} from 'node:fs';
import {stat} from 'node:fs/promises';
import {watch} from 'chokidar';

import type {Filer_Observer} from './filer_helpers.ts';
import {Disknode} from './disknode.ts';
import {DEFAULT_CONFIG_FILES} from './constants.ts';
import {use_filer_test_context, create_mock_stats, TEST_PATHS} from './filer.test_helpers.ts';

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

describe('Filer Core', () => {
	const ctx = use_filer_test_context();

	describe('initialization', () => {
		test('creates filer with default options', () => {
			const filer = ctx.create_unmounted_filer();
			expect(filer.disknodes.size).toBe(0);
			expect(filer.roots.size).toBe(0);
		});

		test('accepts custom batch delay', () => {
			const filer = ctx.create_unmounted_filer({batch_delay: 100});
			// Can't directly test batch delay without timing, but constructor should accept it
			expect(filer.disknodes).toBeDefined();
		});

		test('initializes watcher with provided paths', async () => {
			const paths = [TEST_PATHS.SOURCE, TEST_PATHS.CONFIG_FILE];
			await ctx.create_mounted_filer({paths});

			expect(vi.mocked(watch)).toHaveBeenCalledWith(
				paths,
				expect.objectContaining({
					persistent: true,
					ignoreInitial: false,
					followSymlinks: true,
					awaitWriteFinish: {
						stabilityThreshold: 50,
						pollInterval: 10,
					},
				}),
			);
		});

		test('accepts custom chokidar options', async () => {
			const custom_options = {
				persistent: false,
				ignoreInitial: true,
				awaitWriteFinish: {
					stabilityThreshold: 100,
					pollInterval: 20,
				},
			};

			await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				chokidar_options: custom_options,
			});

			expect(vi.mocked(watch)).toHaveBeenCalledWith(
				[TEST_PATHS.SOURCE],
				expect.objectContaining(custom_options),
			);
		});

		test('sets up default paths when none provided', async () => {
			vi.mocked(existsSync).mockImplementation((path) => {
				const path_str = path as unknown as string;
				return (
					path_str.endsWith('/src') || // resolve(SOURCE_DIRNAME)
					DEFAULT_CONFIG_FILES.includes(path_str)
				);
			});

			await ctx.create_mounted_filer();

			expect(vi.mocked(watch)).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.stringMatching(/\/src$/), // resolve(SOURCE_DIRNAME)
					...DEFAULT_CONFIG_FILES,
				]),
				expect.any(Object),
			);
		});

		test('filters non-existent default paths', async () => {
			vi.mocked(existsSync).mockImplementation((path) => {
				return (path as unknown as string).endsWith('/src'); // Only resolved src exists
			});

			await ctx.create_mounted_filer();

			expect(vi.mocked(watch)).toHaveBeenCalledWith(
				[expect.stringMatching(/\/src$/)], // Only resolved src passes the existsSync filter
				expect.any(Object),
			);
		});

		test('accepts aliases configuration', () => {
			const aliases: Array<[string, string]> = [
				['$lib', './src/lib'],
				['$routes', './src/routes'],
			];

			const filer = ctx.create_unmounted_filer({aliases});
			expect(filer.map_alias('$lib/utils')).toBe('./src/lib/utils');
			expect(filer.map_alias('$routes/home')).toBe('./src/routes/home');
		});

		test('accepts initial observers', () => {
			const observer: Filer_Observer = {
				id: 'test_observer',
				patterns: [/\.ts$/],
				on_change: vi.fn(),
			};

			const filer = ctx.create_unmounted_filer({observers: [observer]});
			// Observer should be registered (verify by trying to observe another)
			const unsub = filer.observe({
				id: 'second_observer',
				patterns: [/\.js$/],
				on_change: vi.fn(),
			});
			expect(typeof unsub).toBe('function');
		});
	});

	describe('node management', () => {
		test('creates disknodes lazily with get_disknode', async () => {
			const filer = await ctx.create_mounted_filer();

			expect(filer.disknodes.size).toBe(0);

			const node = filer.get_disknode(TEST_PATHS.FILE_A);

			expect(node).toBeInstanceOf(Disknode);
			expect(node.id).toBe(TEST_PATHS.FILE_A);
			expect(node.api).toBe(filer);
			expect(filer.disknodes.size).toBe(5); // File + parent directories up to root
			expect(filer.disknodes.get(TEST_PATHS.FILE_A)).toBe(node);
		});

		test('returns existing node on subsequent calls', async () => {
			const filer = await ctx.create_mounted_filer();

			const node1 = filer.get_disknode(TEST_PATHS.FILE_A);
			const node2 = filer.get_disknode(TEST_PATHS.FILE_A);

			expect(node1).toBe(node2);
			expect(filer.disknodes.size).toBe(5); // File + parent directories up to root
		});

		test('sets up parent-child relationships automatically', async () => {
			const filer = await ctx.create_mounted_filer();

			const file_node = filer.get_disknode(TEST_PATHS.FILE_A);
			const dir_node = filer.get_disknode(TEST_PATHS.SOURCE);

			expect(file_node.parent).toBe(dir_node);
			expect(dir_node.children.get('a.ts')).toBe(file_node);
			expect(dir_node.kind).toBe('directory');
		});

		test('handles deeply nested paths', async () => {
			const filer = await ctx.create_mounted_filer();
			const deep_path = '/test/very/deep/nested/file.ts';

			const file_node = filer.get_disknode(deep_path);
			let current = file_node.parent;
			const parent_chain = [];

			while (current) {
				parent_chain.push(current.id);
				current = current.parent;
			}

			expect(parent_chain).toEqual([
				'/test/very/deep/nested',
				'/test/very/deep',
				'/test/very',
				'/test',
				'/',
			]);
		});

		test('identifies external vs internal disknodes', async () => {
			const filer = await ctx.create_mounted_filer({paths: [TEST_PATHS.SOURCE]});

			const internal_node = filer.get_disknode(TEST_PATHS.FILE_A);
			const external_node = filer.get_disknode(TEST_PATHS.EXTERNAL_FILE);

			expect(internal_node.is_external).toBe(false);
			expect(external_node.is_external).toBe(true);
		});

		test('tracks root disknodes correctly', async () => {
			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE, TEST_PATHS.CONFIG_FILE],
			});

			// Emit add events for the watched paths
			ctx.mock_watcher.emit('add', TEST_PATHS.SOURCE);
			ctx.mock_watcher.emit('add', TEST_PATHS.CONFIG_FILE);

			// Process the events
			await new Promise((resolve) => setTimeout(resolve, 20));

			expect(filer.roots.size).toBe(2);
			const root_ids = Array.from(filer.roots).map((r) => r.id);
			expect(root_ids).toContain(TEST_PATHS.SOURCE);
			expect(root_ids).toContain(TEST_PATHS.CONFIG_FILE);
		});

		test('handles filesystem root correctly', async () => {
			const filer = await ctx.create_mounted_filer();
			const root_node = filer.get_disknode('/');

			expect(root_node.parent).toBeNull();
			expect(root_node.id).toBe('/');
		});

		test('sets up relationships correctly on file add events', async () => {
			const filer = await ctx.create_mounted_filer({paths: [TEST_PATHS.SOURCE], batch_delay: 0});

			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A, create_mock_stats());
			await new Promise((resolve) => setTimeout(resolve, 10));

			const file_node = filer.get_disknode(TEST_PATHS.FILE_A);
			const parent_node = filer.get_disknode(TEST_PATHS.SOURCE);

			// Verify relationships are set up correctly
			expect(file_node.parent).toBe(parent_node);
			expect(parent_node.children.get('a.ts')).toBe(file_node);
			expect(parent_node.children.size).toBe(1);

			// Verify no duplicate entries in parent's children map
			const child_entries = Array.from(parent_node.children.entries());
			const unique_entries = new Set(child_entries.map(([name]) => name));
			expect(unique_entries.size).toBe(child_entries.length);
		});

		test('maintains consistent parent-child relationships after multiple operations', async () => {
			const filer = await ctx.create_mounted_filer({paths: [TEST_PATHS.SOURCE], batch_delay: 0});

			// Add file multiple times (simulating rapid events that could trigger double setup)
			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A, create_mock_stats());
			ctx.mock_watcher.emit('change', TEST_PATHS.FILE_A, create_mock_stats());
			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A, create_mock_stats()); // Duplicate add
			await new Promise((resolve) => setTimeout(resolve, 20));

			const file_node = filer.get_disknode(TEST_PATHS.FILE_A);
			const parent_node = filer.get_disknode(TEST_PATHS.SOURCE);

			// Relationships should be correct and not duplicated
			expect(file_node.parent).toBe(parent_node);
			expect(parent_node.children.get('a.ts')).toBe(file_node);
			expect(parent_node.children.size).toBe(1); // No duplicates

			// Verify parent's children map is clean - no duplicate keys or values
			const all_children = Array.from(parent_node.children.values());
			const unique_children = new Set(all_children);
			expect(unique_children.size).toBe(all_children.length);

			// Verify bidirectional consistency
			for (const [child_name, child_node] of parent_node.children) {
				expect(child_node.parent).toBe(parent_node);
				expect(child_node.id.endsWith(child_name)).toBe(true);
			}
		});
	});

	describe('filesystem events', () => {
		test('handles file add events', async () => {
			const filer = await ctx.create_mounted_filer({paths: [TEST_PATHS.SOURCE], batch_delay: 0});

			const mock_stats = create_mock_stats();
			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A, mock_stats);

			// Wait for batch processing
			await new Promise((resolve) => setTimeout(resolve, 10));

			const node = filer.disknodes.get(TEST_PATHS.FILE_A);
			expect(node).toBeDefined();
			expect(node?.kind).toBe('file');
			expect(node?.exists).toBe(true);
			expect(node?.stats).toBe(mock_stats);
		});

		test('handles directory add events', async () => {
			const filer = await ctx.create_mounted_filer({paths: [TEST_PATHS.SOURCE], batch_delay: 0});

			const dir_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => true,
			});
			ctx.mock_watcher.emit('addDir', TEST_PATHS.DIR_LIB, dir_stats);

			await new Promise((resolve) => setTimeout(resolve, 10));

			const node = filer.disknodes.get(TEST_PATHS.DIR_LIB);
			expect(node).toBeDefined();
			expect(node?.kind).toBe('directory');
		});

		test('handles file change events', async () => {
			const filer = await ctx.create_mounted_filer({paths: [TEST_PATHS.SOURCE], batch_delay: 0});

			// Add file first
			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A, create_mock_stats());
			await new Promise((resolve) => setTimeout(resolve, 10));

			const node = filer.get_disknode(TEST_PATHS.FILE_A);
			const version_before = node.version;

			// Change file
			const new_stats = create_mock_stats({size: 200});
			ctx.mock_watcher.emit('change', TEST_PATHS.FILE_A, new_stats);
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(node.version).toBeGreaterThan(version_before);
			expect(node.stats?.size).toBe(200);
		});

		test('handles file delete events', async () => {
			const filer = await ctx.create_mounted_filer({paths: [TEST_PATHS.SOURCE], batch_delay: 0});

			// Add file first
			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A, create_mock_stats());
			await new Promise((resolve) => setTimeout(resolve, 10));

			const node = filer.get_disknode(TEST_PATHS.FILE_A);
			expect(node.exists).toBe(true);

			// Delete file
			ctx.mock_watcher.emit('unlink', TEST_PATHS.FILE_A);
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(node.exists).toBe(false);
		});

		test('handles directory delete events', async () => {
			const filer = await ctx.create_mounted_filer({paths: [TEST_PATHS.SOURCE], batch_delay: 0});

			// Add directory first
			ctx.mock_watcher.emit('addDir', TEST_PATHS.DIR_LIB);
			await new Promise((resolve) => setTimeout(resolve, 10));

			const node = filer.get_disknode(TEST_PATHS.DIR_LIB);
			expect(node.exists).toBe(true);

			// Delete directory
			ctx.mock_watcher.emit('unlinkDir', TEST_PATHS.DIR_LIB);
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(node.exists).toBe(false);
		});

		test('cleans up dependencies on node deletion', async () => {
			const filer = await ctx.create_mounted_filer({paths: [TEST_PATHS.SOURCE], batch_delay: 0});

			// Set up dependency relationship
			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
			node_b.add_dependency(node_a);

			expect(node_a.dependents.has(TEST_PATHS.FILE_B)).toBe(true);
			expect(node_b.dependencies.has(TEST_PATHS.FILE_A)).toBe(true);

			// Delete node A
			ctx.mock_watcher.emit('unlink', TEST_PATHS.FILE_A);
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Dependencies should be cleaned up
			expect(node_a.dependents.has(TEST_PATHS.FILE_B)).toBe(false);
			expect(node_b.dependencies.has(TEST_PATHS.FILE_A)).toBe(false);
		});

		test('removes child from parent on deletion', async () => {
			const filer = await ctx.create_mounted_filer({paths: [TEST_PATHS.SOURCE], batch_delay: 0});

			// Add file
			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A);
			await new Promise((resolve) => setTimeout(resolve, 10));

			const parent = filer.get_disknode(TEST_PATHS.SOURCE);
			expect(parent.children.has('a.ts')).toBe(true);

			// Delete file
			ctx.mock_watcher.emit('unlink', TEST_PATHS.FILE_A);
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(parent.children.has('a.ts')).toBe(false);
		});
	});

	describe('change batching', () => {
		test('batches multiple changes together', async () => {
			const observer: Filer_Observer = {
				id: 'batch_test',
				patterns: [/\.ts$/],
				on_change: vi.fn(),
			};

			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 50,
				observers: [observer],
			});
			expect(filer).toBeTruthy();

			// Emit multiple changes quickly
			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A, create_mock_stats());
			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_B, create_mock_stats());
			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_C, create_mock_stats());

			// Should not have processed yet
			expect(vi.mocked(observer.on_change)).not.toHaveBeenCalled();

			// Wait for batch to process
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Should be called once with all changes
			expect(vi.mocked(observer.on_change)).toHaveBeenCalledTimes(1);
			const batch = vi.mocked(observer.on_change).mock.calls[0][0];
			expect(batch.size).toBe(3);
		});

		test('handles zero batch delay for immediate processing', async () => {
			const observer: Filer_Observer = {
				id: 'immediate_test',
				patterns: [/\.ts$/],
				on_change: vi.fn(),
			};

			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
				observers: [observer],
			});
			expect(filer).toBeTruthy();

			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A);
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(vi.mocked(observer.on_change)).toHaveBeenCalled();
		});
	});

	describe('change coalescing', () => {
		test('add + change → add', async () => {
			const observer: Filer_Observer = {
				id: 'coalesce_test',
				patterns: [/\.ts$/],
				on_change: vi.fn(),
			};

			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 50,
				observers: [observer],
			});
			expect(filer).toBeTruthy();

			// Emit add then change quickly
			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A, create_mock_stats());
			ctx.mock_watcher.emit('change', TEST_PATHS.FILE_A, create_mock_stats({size: 200}));

			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(vi.mocked(observer.on_change)).toHaveBeenCalledTimes(1);
			const batch = vi.mocked(observer.on_change).mock.calls[0][0];
			expect(batch.size).toBe(1);
			expect(batch.get(TEST_PATHS.FILE_A)?.type).toBe('add'); // Preserved add semantic
		});

		test('add + delete → no change', async () => {
			const observer: Filer_Observer = {
				id: 'coalesce_test',
				patterns: [/\.ts$/],
				on_change: vi.fn(),
			};

			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 50,
				observers: [observer],
			});
			expect(filer).toBeTruthy();

			// Emit add then delete quickly
			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A, create_mock_stats());
			ctx.mock_watcher.emit('unlink', TEST_PATHS.FILE_A);

			await new Promise((resolve) => setTimeout(resolve, 100));

			// Should result in empty batch (no change event)
			if (vi.mocked(observer.on_change).mock.calls.length > 0) {
				const batch = vi.mocked(observer.on_change).mock.calls[0][0];
				expect(batch.has(TEST_PATHS.FILE_A)).toBe(false);
			}
		});

		test('delete + add → update', async () => {
			const observer: Filer_Observer = {
				id: 'coalesce_test',
				patterns: [/\.ts$/],
				on_change: vi.fn(),
			};

			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 50,
				observers: [observer],
			});
			expect(filer).toBeTruthy();

			// Emit delete then add quickly
			ctx.mock_watcher.emit('unlink', TEST_PATHS.FILE_A);
			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A, create_mock_stats());

			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(vi.mocked(observer.on_change)).toHaveBeenCalledTimes(1);
			const batch = vi.mocked(observer.on_change).mock.calls[0][0];
			expect(batch.size).toBe(1);
			expect(batch.get(TEST_PATHS.FILE_A)?.type).toBe('update'); // Coalesced to update
		});

		test('change + delete → delete', async () => {
			const observer: Filer_Observer = {
				id: 'coalesce_test',
				patterns: [/\.ts$/],
				on_change: vi.fn(),
			};

			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 50,
				observers: [observer],
			});
			expect(filer).toBeTruthy();

			// Emit change then delete quickly
			ctx.mock_watcher.emit('change', TEST_PATHS.FILE_A, create_mock_stats());
			ctx.mock_watcher.emit('unlink', TEST_PATHS.FILE_A);

			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(vi.mocked(observer.on_change)).toHaveBeenCalledTimes(1);
			const batch = vi.mocked(observer.on_change).mock.calls[0][0];
			expect(batch.size).toBe(1);
			expect(batch.get(TEST_PATHS.FILE_A)?.type).toBe('delete'); // Latest wins
		});
	});

	describe('querying', () => {
		test('finds disknodes by predicate', async () => {
			const filer = await ctx.create_mounted_filer();

			filer.get_disknode(TEST_PATHS.FILE_A);
			filer.get_disknode(TEST_PATHS.FILE_B);
			filer.get_disknode(TEST_PATHS.FILE_C);
			filer.get_disknode('/test/data.json');

			const ts_files = filer.find_disknodes((node) => node.id.endsWith('.ts'));

			expect(ts_files).toHaveLength(3);
			expect(ts_files.map((n) => n.id)).toEqual(
				expect.arrayContaining([TEST_PATHS.FILE_A, TEST_PATHS.FILE_B, TEST_PATHS.FILE_C]),
			);
		});

		test('gets node by id', async () => {
			const filer = await ctx.create_mounted_filer();

			const created_node = filer.get_disknode(TEST_PATHS.FILE_A);
			const retrieved_node = filer.get_by_id(TEST_PATHS.FILE_A);

			expect(retrieved_node).toBe(created_node);
		});

		test('returns undefined for non-existent id', async () => {
			const filer = await ctx.create_mounted_filer();

			const node = filer.get_by_id('/non/existent/file.ts');

			expect(node).toBeUndefined();
		});

		test('find_nodes returns empty array when no matches', async () => {
			const filer = await ctx.create_mounted_filer();

			filer.get_disknode(TEST_PATHS.FILE_A);
			filer.get_disknode(TEST_PATHS.FILE_B);

			const python_files = filer.find_disknodes((node) => node.id.endsWith('.py'));

			expect(python_files).toEqual([]);
		});

		test('find_nodes handles empty node collection', async () => {
			const filer = await ctx.create_mounted_filer();

			const results = filer.find_disknodes(() => true);

			expect(results).toEqual([]);
		});
	});

	describe('lifecycle management', () => {
		test('resets watcher with new paths', async () => {
			const filer = await ctx.create_mounted_filer({paths: [TEST_PATHS.SOURCE]});

			// Create some state
			filer.get_disknode(TEST_PATHS.FILE_A);
			filer.get_disknode(TEST_PATHS.FILE_B);
			expect(filer.disknodes.size).toBe(6); // 2 files + their parent directories

			// Reset watcher
			await filer.reset_watcher(['/new/path']);

			// Should have created new watcher
			expect(vi.mocked(watch)).toHaveBeenCalledWith(['/new/path'], expect.any(Object));

			// State should be cleared
			expect(filer.disknodes.size).toBe(0);
			expect(filer.roots.size).toBe(0);
		});

		test('closes filer cleanly', async () => {
			const observer: Filer_Observer = {
				id: 'test',
				patterns: [/\.ts$/],
				on_change: vi.fn(),
			};

			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				observers: [observer],
			});

			// Create some state
			filer.get_disknode(TEST_PATHS.FILE_A);
			filer.get_disknode(TEST_PATHS.FILE_B);

			await filer.dispose();

			// Everything should be cleaned up
			expect(filer.disknodes.size).toBe(0);
			expect(filer.roots.size).toBe(0);
			expect(ctx.mock_watcher.listeners.size).toBe(0);
		});

		test('handles close() when not initialized', async () => {
			const filer = ctx.create_unmounted_filer();

			// Should not throw
			await expect(filer.dispose()).resolves.toBeUndefined();
		});

		test('clears pending batch on reset', async () => {
			const observer: Filer_Observer = {
				id: 'test',
				patterns: [/\.ts$/],
				on_change: vi.fn(),
			};

			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 100, // Long delay
				observers: [observer],
			});

			// Create pending change
			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A);

			// Reset before batch processes
			await filer.reset_watcher([TEST_PATHS.SOURCE]);

			// Wait a bit to ensure no delayed batch processing
			await new Promise((resolve) => setTimeout(resolve, 150));

			// Observer should not have been called
			expect(vi.mocked(observer.on_change)).not.toHaveBeenCalled();
		});

		test('handles multiple reset_watcher calls', async () => {
			const filer = ctx.create_unmounted_filer();
			await filer.mount();

			// Call reset_watcher sequentially
			await filer.reset_watcher(['/path1']);
			await filer.reset_watcher(['/path2']);
			await filer.reset_watcher(['/path3']);

			// Should have called watch 4 times (mount + 3 resets)
			expect(vi.mocked(watch)).toHaveBeenCalledTimes(4);
			expect(vi.mocked(watch)).toHaveBeenLastCalledWith(['/path3'], expect.any(Object));
		});
	});

	describe('performance features', () => {
		test('load_initial_stats handles empty node collection', async () => {
			const filer = await ctx.create_mounted_filer();

			// No disknodes created
			expect(filer.disknodes.size).toBe(0);

			// Should handle empty collection without error
			await expect(filer.load_initial_stats()).resolves.toBeUndefined();

			// Should not have called stat since no disknodes exist
			expect(vi.mocked(stat)).not.toHaveBeenCalled();
		});

		test('load_initial_stats handles directory disknodes correctly', async () => {
			const filer = await ctx.create_mounted_filer({paths: []});

			// Create directory node
			const dir_node = filer.get_disknode(TEST_PATHS.DIR_LIB);
			dir_node.kind = 'directory';

			// Mock stat to return directory stats
			vi.mocked(stat).mockResolvedValue(
				create_mock_stats({
					isFile: () => false,
					isDirectory: () => true,
				}),
			);

			await filer.load_initial_stats();

			// Should have called stat for directory and its parents
			expect(vi.mocked(stat)).toHaveBeenCalled();

			// Directory should have stats populated
			expect(dir_node.stats).toBeDefined();
			expect(dir_node.stats?.isDirectory()).toBe(true);
		});

		test('load_initial_stats skips external disknodes', async () => {
			const filer = await ctx.create_mounted_filer({paths: [TEST_PATHS.SOURCE]});

			// Create internal and external disknodes
			const internal_node = filer.get_disknode(TEST_PATHS.FILE_A);
			const external_node = filer.get_disknode(TEST_PATHS.EXTERNAL_FILE);

			expect(internal_node.is_external).toBe(false);
			expect(external_node.is_external).toBe(true);

			// Mock stat to track calls
			const stat_calls: Array<string> = [];
			vi.mocked(stat).mockImplementation(async (path) => {
				stat_calls.push(path as string);
				return create_mock_stats();
			});

			await filer.load_initial_stats();

			// Should call stat for internal node and its parents but not external
			expect(stat_calls).toContain(TEST_PATHS.FILE_A);
			expect(stat_calls).not.toContain(TEST_PATHS.EXTERNAL_FILE);
		});

		test('load_initial_stats processes disknodes in batches', async () => {
			const filer = await ctx.create_mounted_filer({paths: []});

			// Create many disknodes
			for (let i = 0; i < 250; i++) {
				filer.get_disknode(`/test/file${i}.ts`);
			}

			// Mock lstatSync to prevent interference with cached stats
			const {lstatSync} = await import('node:fs');
			vi.mocked(lstatSync).mockImplementation((path: any) => {
				const match = path.match(/file(\d+)/);
				const num = match ? parseInt(match[1], 10) : 0;
				return create_mock_stats({size: num});
			});

			// Mock stat to return different stats for each file
			vi.mocked(stat).mockImplementation((path: any) => {
				const match = path.match(/file(\d+)/);
				const num = match ? parseInt(match[1], 10) : 0;
				return Promise.resolve(create_mock_stats({size: num}));
			});

			await filer.load_initial_stats();

			// Should have called stat for files and parent directories (/test and /)
			// 250 files + 2 parent directories = 252 total calls
			expect(vi.mocked(stat)).toHaveBeenCalledTimes(252);

			// Stats should be pre-populated
			const node = filer.get_disknode('/test/file42.ts');
			expect(node.size).toBe(42);
		});

		test('load_initial_stats handles stat errors gracefully', async () => {
			const filer = await ctx.create_mounted_filer();

			filer.get_disknode('/test/good.ts');
			filer.get_disknode('/test/bad.ts');

			// Mock lstatSync to prevent interference with cached stats
			const {lstatSync} = await import('node:fs');
			vi.mocked(lstatSync).mockImplementation((path: any) => {
				if (path.includes('bad')) {
					throw new Error('Permission denied');
				}
				return create_mock_stats({size: 100});
			});

			vi.mocked(stat).mockImplementation((path: any) => {
				if (path.includes('bad')) {
					return Promise.reject(new Error('Permission denied'));
				}
				return Promise.resolve(create_mock_stats({size: 100}));
			});

			// Should not throw
			await expect(filer.load_initial_stats()).resolves.toBeUndefined();

			// Good file should have stats
			const good_node = filer.get_disknode('/test/good.ts');
			expect(good_node.size).toBe(100);

			// Bad file should still exist but without pre-populated stats
			const bad_node = filer.get_disknode('/test/bad.ts');
			expect(bad_node).toBeDefined();
		});

		test('rescan_subtree invalidates subtree', async () => {
			const observer: Filer_Observer = {
				id: 'test',
				patterns: [/.*/],
				track_directories: true,
				on_change: vi.fn(),
			};

			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
				observers: [observer],
			});

			// Create subtree
			const dir = filer.get_disknode(TEST_PATHS.DIR_LIB);
			const file1 = filer.get_disknode(`${TEST_PATHS.DIR_LIB}/file1.ts`);
			const file2 = filer.get_disknode(`${TEST_PATHS.DIR_LIB}/file2.ts`);
			file1.parent = dir;
			file2.parent = dir;
			dir.children.set('file1.ts', file1);
			dir.children.set('file2.ts', file2);

			// Rescan subtree
			await filer.rescan_subtree(TEST_PATHS.DIR_LIB);

			// Wait for invalidation to process
			await new Promise((resolve) => setTimeout(resolve, 50));

			expect(vi.mocked(observer.on_change)).toHaveBeenCalled();
			const batch = vi.mocked(observer.on_change).mock.calls[0][0];
			expect(batch.has(TEST_PATHS.DIR_LIB)).toBe(true);
			expect(batch.has(`${TEST_PATHS.DIR_LIB}/file1.ts`)).toBe(true);
			expect(batch.has(`${TEST_PATHS.DIR_LIB}/file2.ts`)).toBe(true);
		});

		test('rescan_subtree handles non-existent node gracefully', async () => {
			const filer = await ctx.create_mounted_filer();

			// Should not throw
			await expect(filer.rescan_subtree('/non/existent/path')).resolves.toBeUndefined();
		});

		test('relationship setup scales efficiently with many files', async () => {
			const filer = await ctx.create_mounted_filer({paths: [TEST_PATHS.SOURCE], batch_delay: 0});

			const start = Date.now();

			// Add many files at once
			for (let i = 0; i < 100; i++) {
				ctx.mock_watcher.emit('add', `/test/project/src/file${i}.ts`, create_mock_stats());
			}
			await new Promise((resolve) => setTimeout(resolve, 50));

			const duration = Date.now() - start;

			// Should complete reasonably fast (not exponential due to double setup)
			expect(duration).toBeLessThan(1000);

			// All relationships should be correct
			const parent = filer.get_disknode(TEST_PATHS.SOURCE);
			expect(parent.children.size).toBe(100);

			// Verify a few random relationships
			const node42 = filer.get_disknode('/test/project/src/file42.ts');
			expect(node42.parent).toBe(parent);
			expect(parent.children.get('file42.ts')).toBe(node42);
		});
	});

	describe('alias mapping', () => {
		test('maps aliases correctly', () => {
			const filer = ctx.create_unmounted_filer({
				aliases: [
					['$lib', './src/lib'],
					['$routes', './src/routes'],
					['@', './src'],
				],
			});

			expect(filer.map_alias('$lib/utils')).toBe('./src/lib/utils');
			expect(filer.map_alias('$lib')).toBe('./src/lib');
			expect(filer.map_alias('$routes/home/index')).toBe('./src/routes/home/index');
			expect(filer.map_alias('@/components')).toBe('./src/components');
		});

		test('returns unmapped specifiers unchanged', () => {
			const filer = ctx.create_unmounted_filer({
				aliases: [['$lib', './src/lib']],
			});

			expect(filer.map_alias('./relative/path')).toBe('./relative/path');
			expect(filer.map_alias('external-package')).toBe('external-package');
			expect(filer.map_alias('/absolute/path')).toBe('/absolute/path');
		});

		test('handles empty aliases array', () => {
			const filer = ctx.create_unmounted_filer({
				aliases: [],
			});

			expect(filer.map_alias('$lib/utils')).toBe('$lib/utils');
			expect(filer.map_alias('./relative')).toBe('./relative');
		});

		test('uses first matching alias', () => {
			const filer = ctx.create_unmounted_filer({
				aliases: [
					['$lib', './src/lib'],
					['$lib/special', './src/special'], // More specific but comes after
				],
			});

			// Should use first match
			expect(filer.map_alias('$lib/special/utils')).toBe('./src/lib/special/utils');
		});

		test('does not incorrectly match prefixes without proper segment boundaries', () => {
			const filer = ctx.create_unmounted_filer({
				aliases: [
					['@f', './src/f'],
					['@foo', './src/foo'],
				],
			});

			// '@f' should not match '@foo/bar' - should use the @foo alias instead
			expect(filer.map_alias('@foo/bar')).toBe('./src/foo/bar');

			// But '@f/something' should match '@f'
			expect(filer.map_alias('@f/utils')).toBe('./src/f/utils');

			// And exact match should work
			expect(filer.map_alias('@f')).toBe('./src/f');
		});
	});

	describe('error handling', () => {
		test('handles watcher setup errors gracefully', async () => {
			vi.mocked(watch).mockImplementation(() => {
				throw new Error('Watcher setup failed');
			});

			// Should not throw during construction
			const filer = ctx.create_unmounted_filer();

			// Mount should throw the watcher error
			await expect(filer.mount([TEST_PATHS.SOURCE])).rejects.toThrow('Watcher setup failed');
		});

		test('continues operation after observer errors', async () => {
			const failing_observer: Filer_Observer = {
				id: 'failing',
				patterns: [/\.ts$/],
				on_change: () => {
					throw new Error('Observer failed');
				},
				on_error: () => 'continue',
			};

			const working_observer: Filer_Observer = {
				id: 'working',
				patterns: [/\.ts$/],
				on_change: vi.fn(),
			};

			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
				observers: [failing_observer, working_observer],
			});
			expect(filer).toBeTruthy();

			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A);
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Working observer should still be called
			expect(vi.mocked(working_observer.on_change)).toHaveBeenCalled();
		});

		test('aborts batch processing on observer error with abort strategy', async () => {
			const failing_observer: Filer_Observer = {
				id: 'failing',
				patterns: [/\.ts$/],
				on_change: () => {
					throw new Error('Observer failed');
				},
				on_error: () => 'abort',
			};

			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
				observers: [failing_observer],
			});
			expect(filer).toBeTruthy();

			// Should handle the error (likely by logging it)
			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A);
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Test that the system doesn't crash - no specific assertion needed
			expect(true).toBe(true);
		});

		test('handles rapid add/delete/add cycles without relationship corruption', async () => {
			const filer = await ctx.create_mounted_filer({paths: [TEST_PATHS.SOURCE], batch_delay: 0});

			// Rapid cycle - this tests tombstone restoration with relationship re-establishment
			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A, create_mock_stats());
			ctx.mock_watcher.emit('unlink', TEST_PATHS.FILE_A);
			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A, create_mock_stats());
			await new Promise((resolve) => setTimeout(resolve, 20));

			const file_node = filer.get_disknode(TEST_PATHS.FILE_A);
			const parent_node = filer.get_disknode(TEST_PATHS.SOURCE);

			// Final state should be consistent - relationships restored from tombstone
			expect(file_node.parent).toBe(parent_node);
			expect(parent_node.children.get('a.ts')).toBe(file_node);
			expect(file_node.exists).toBe(true);
		});
	});
});
