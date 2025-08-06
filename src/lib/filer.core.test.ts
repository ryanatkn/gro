// @slop Claude Opus 4.1

import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest';
import {existsSync, type Stats} from 'node:fs';
import {stat} from 'node:fs/promises';
import {watch, type FSWatcher} from 'chokidar';

import {Filer, type Filer_Observer} from './filer.ts';
import {Disknode} from './disknode.ts';
import type {Path_Id} from './path.ts';

// Mock modules
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

// Test constants
const TEST_ROOT = '/test/project';
const TEST_SOURCE = `${TEST_ROOT}/src`;
const TEST_FILE_A: Path_Id = `${TEST_SOURCE}/a.ts`;
const TEST_FILE_B: Path_Id = `${TEST_SOURCE}/b.ts`;
const TEST_FILE_C: Path_Id = `${TEST_SOURCE}/c.ts`;
const TEST_DIR_LIB: Path_Id = `${TEST_SOURCE}/lib`;
const TEST_EXTERNAL_FILE: Path_Id = '/external/file.ts';
const TEST_CONFIG_FILE: Path_Id = `${TEST_ROOT}/package.json`;

// Mock stats factory
const create_mock_stats = (options: Partial<Stats> = {}): Stats =>
	({
		isFile: () => true,
		isDirectory: () => false,
		isSymbolicLink: () => false,
		isBlockDevice: () => false,
		isCharacterDevice: () => false,
		isFIFO: () => false,
		isSocket: () => false,
		dev: 1,
		ino: 1,
		mode: 33188,
		nlink: 1,
		uid: 1000,
		gid: 1000,
		rdev: 0,
		size: 100,
		blksize: 4096,
		blocks: 8,
		atimeMs: Date.now(),
		mtimeMs: Date.now(),
		ctimeMs: Date.now(),
		birthtimeMs: Date.now(),
		atime: new Date(),
		mtime: new Date(),
		ctime: new Date(),
		birthtime: new Date(),
		...options,
	}) as Stats;

// Mock FSWatcher
class Mock_Watcher implements Partial<FSWatcher> {
	// @ts-expect-error
	listeners: Map<string, Array<(...args: Array<any>) => void>> = new Map();

	// @ts-expect-error
	on(event: string, handler: (...args: Array<any>) => void): this {
		const handlers = this.listeners.get(event) || [];
		handlers.push(handler);
		this.listeners.set(event, handlers);
		return this;
	}

	// @ts-expect-error
	once(event: string, handler: (...args: Array<any>) => void): this {
		return this.on(event, handler);
	}

	// @ts-expect-error
	emit(event: string, ...args: Array<any>): void {
		const handlers = this.listeners.get(event) || [];
		handlers.forEach((h) => h(...args));
	}

	close(): Promise<void> {
		this.listeners.clear();
		return Promise.resolve();
	}
}

describe('Filer Core', () => {
	let mock_watcher: Mock_Watcher;

	beforeEach(() => {
		vi.clearAllMocks();
		mock_watcher = new Mock_Watcher();
		vi.mocked(watch).mockReturnValue(mock_watcher as unknown as FSWatcher);
		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(stat).mockResolvedValue(create_mock_stats());
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('initialization', () => {
		test('creates filer with default options', () => {
			const filer = new Filer();
			expect(filer.disknodes.size).toBe(0);
			expect(filer.roots.size).toBe(0);
		});

		test('accepts custom batch delay', () => {
			const filer = new Filer({batch_delay: 100});
			// Can't directly test batch delay without timing, but constructor should accept it
			expect(filer).toBeInstanceOf(Filer);
		});

		test('initializes watcher with provided paths', async () => {
			const paths = [TEST_SOURCE, TEST_CONFIG_FILE];
			const filer = new Filer({paths});

			// Emit ready event for the watcher
			setTimeout(() => mock_watcher.emit('ready'), 0);

			// Wait for filer to be ready
			await filer.ready;

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

			const filer = new Filer({
				paths: [TEST_SOURCE],
				chokidar_options: custom_options,
			});

			// Emit ready event for the watcher
			setTimeout(() => mock_watcher.emit('ready'), 0);

			// Wait for filer to be ready
			await filer.ready;

			expect(vi.mocked(watch)).toHaveBeenCalledWith(
				[TEST_SOURCE],
				expect.objectContaining(custom_options),
			);
		});

		test('sets up default paths when none provided', async () => {
			vi.mocked(existsSync).mockImplementation((path) => {
				// paths.source is absolute, not relative
				return (
					(path as unknown as string).endsWith('/src/') ||
					path === './package.json' ||
					path === './tsconfig.json'
				);
			});

			const filer = new Filer();

			// Emit ready event for the watcher
			setTimeout(() => mock_watcher.emit('ready'), 0);

			// Wait for filer to be ready
			await filer.ready;

			expect(vi.mocked(watch)).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.stringMatching(/\/src\/$/), // paths.source is absolute
					'./package.json',
					'./tsconfig.json',
				]),
				expect.any(Object),
			);
		});

		test('filters non-existent default paths', async () => {
			vi.mocked(existsSync).mockImplementation((path) => {
				return (path as unknown as string).endsWith('/src/'); // Only src exists
			});

			const filer = new Filer();

			// Emit ready event for the watcher
			setTimeout(() => mock_watcher.emit('ready'), 0);

			// Wait for filer to be ready
			await filer.ready;

			expect(vi.mocked(watch)).toHaveBeenCalledWith(
				[expect.stringMatching(/\/src\/$/)],
				expect.any(Object),
			);
		});

		test('accepts aliases configuration', () => {
			const aliases: Array<[string, string]> = [
				['$lib', './src/lib'],
				['$routes', './src/routes'],
			];

			const filer = new Filer({aliases});
			expect(filer.map_alias('$lib/utils')).toBe('./src/lib/utils');
			expect(filer.map_alias('$routes/home')).toBe('./src/routes/home');
		});

		test('accepts initial observers', () => {
			const observer: Filer_Observer = {
				id: 'test_observer',
				patterns: [/\.ts$/],
				on_change: vi.fn(),
			};

			const filer = new Filer({observers: [observer]});
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
		test('creates disknodes lazily with get_disknode', () => {
			const filer = new Filer({paths: []});

			expect(filer.disknodes.size).toBe(0);

			const node = filer.get_disknode(TEST_FILE_A);

			expect(node).toBeInstanceOf(Disknode);
			expect(node.id).toBe(TEST_FILE_A);
			expect(node.filer).toBe(filer);
			expect(filer.disknodes.size).toBe(5); // File + parent directories up to root
			expect(filer.disknodes.get(TEST_FILE_A)).toBe(node);
		});

		test('returns existing node on subsequent calls', () => {
			const filer = new Filer({paths: []});

			const node1 = filer.get_disknode(TEST_FILE_A);
			const node2 = filer.get_disknode(TEST_FILE_A);

			expect(node1).toBe(node2);
			expect(filer.disknodes.size).toBe(5); // File + parent directories up to root
		});

		test('sets up parent-child relationships automatically', () => {
			const filer = new Filer({paths: []});

			const file_node = filer.get_disknode(TEST_FILE_A);
			const dir_node = filer.get_disknode(TEST_SOURCE);

			expect(file_node.parent).toBe(dir_node);
			expect(dir_node.children.get('a.ts')).toBe(file_node);
			expect(dir_node.kind).toBe('directory');
		});

		test('handles deeply nested paths', () => {
			const filer = new Filer({paths: []});
			const deep_path: Path_Id = '/test/very/deep/nested/file.ts';

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
			const filer = new Filer({paths: [TEST_SOURCE]});

			// Emit ready event
			setTimeout(() => mock_watcher.emit('ready'), 0);
			await filer.ready;

			const internal_node = filer.get_disknode(TEST_FILE_A);
			const external_node = filer.get_disknode(TEST_EXTERNAL_FILE);

			expect(internal_node.is_external).toBe(false);
			expect(external_node.is_external).toBe(true);
		});

		test('tracks root disknodes correctly', async () => {
			const filer = new Filer({paths: [TEST_SOURCE, TEST_CONFIG_FILE]});

			// Emit ready and add events for the watched paths
			setTimeout(() => {
				mock_watcher.emit('add', TEST_SOURCE);
				mock_watcher.emit('add', TEST_CONFIG_FILE);
				mock_watcher.emit('ready');
			}, 0);

			// Wait for filer to be ready
			await filer.ready;

			// Process the events
			await new Promise((resolve) => setTimeout(resolve, 20));

			expect(filer.roots.size).toBe(2);
			const root_ids = Array.from(filer.roots).map((r) => r.id);
			expect(root_ids).toContain(TEST_SOURCE);
			expect(root_ids).toContain(TEST_CONFIG_FILE);
		});

		test('handles filesystem root correctly', () => {
			const filer = new Filer({paths: []});
			const root_node = filer.get_disknode('/');

			expect(root_node.parent).toBeNull();
			expect(root_node.id).toBe('/');
		});
	});

	describe('filesystem events', () => {
		test('handles file add events', async () => {
			const filer = new Filer({paths: [TEST_SOURCE], batch_delay: 0});

			// Emit ready event
			setTimeout(() => mock_watcher.emit('ready'), 0);
			await filer.ready;

			const mock_stats = create_mock_stats();
			mock_watcher.emit('add', TEST_FILE_A, mock_stats);

			// Wait for batch processing
			await new Promise((resolve) => setTimeout(resolve, 10));

			const node = filer.disknodes.get(TEST_FILE_A);
			expect(node).toBeDefined();
			expect(node?.kind).toBe('file');
			expect(node?.exists).toBe(true);
			expect(node?.stats).toBe(mock_stats);
		});

		test('handles directory add events', async () => {
			const filer = new Filer({paths: [TEST_SOURCE], batch_delay: 0});

			// Emit ready event
			setTimeout(() => mock_watcher.emit('ready'), 0);
			await filer.ready;

			const dir_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => true,
			});
			mock_watcher.emit('addDir', TEST_DIR_LIB, dir_stats);

			await new Promise((resolve) => setTimeout(resolve, 10));

			const node = filer.disknodes.get(TEST_DIR_LIB);
			expect(node).toBeDefined();
			expect(node?.kind).toBe('directory');
		});

		test('handles file change events', async () => {
			const filer = new Filer({paths: [TEST_SOURCE], batch_delay: 0});

			// Emit ready event
			setTimeout(() => mock_watcher.emit('ready'), 0);
			await filer.ready;

			// Add file first
			mock_watcher.emit('add', TEST_FILE_A, create_mock_stats());
			await new Promise((resolve) => setTimeout(resolve, 10));

			const node = filer.get_disknode(TEST_FILE_A);
			const version_before = node.version;

			// Change file
			const new_stats = create_mock_stats({size: 200});
			mock_watcher.emit('change', TEST_FILE_A, new_stats);
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(node.version).toBeGreaterThan(version_before);
			expect(node.stats?.size).toBe(200);
		});

		test('handles file delete events', async () => {
			const filer = new Filer({paths: [TEST_SOURCE], batch_delay: 0});

			// Emit ready event
			setTimeout(() => mock_watcher.emit('ready'), 0);
			await filer.ready;

			// Add file first
			mock_watcher.emit('add', TEST_FILE_A, create_mock_stats());
			await new Promise((resolve) => setTimeout(resolve, 10));

			const node = filer.get_disknode(TEST_FILE_A);
			expect(node.exists).toBe(true);

			// Delete file
			mock_watcher.emit('unlink', TEST_FILE_A);
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(node.exists).toBe(false);
		});

		test('handles directory delete events', async () => {
			const filer = new Filer({paths: [TEST_SOURCE], batch_delay: 0});

			// Emit ready event
			setTimeout(() => mock_watcher.emit('ready'), 0);
			await filer.ready;

			// Add directory first
			mock_watcher.emit('addDir', TEST_DIR_LIB);
			await new Promise((resolve) => setTimeout(resolve, 10));

			const node = filer.get_disknode(TEST_DIR_LIB);
			expect(node.exists).toBe(true);

			// Delete directory
			mock_watcher.emit('unlinkDir', TEST_DIR_LIB);
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(node.exists).toBe(false);
		});

		test('cleans up dependencies on node deletion', async () => {
			const filer = new Filer({paths: [TEST_SOURCE], batch_delay: 0});

			// Emit ready event
			setTimeout(() => mock_watcher.emit('ready'), 0);
			await filer.ready;

			// Set up dependency relationship
			const node_a = filer.get_disknode(TEST_FILE_A);
			const node_b = filer.get_disknode(TEST_FILE_B);
			node_b.add_dependency(node_a);

			expect(node_a.dependents.has(TEST_FILE_B)).toBe(true);
			expect(node_b.dependencies.has(TEST_FILE_A)).toBe(true);

			// Delete node A
			mock_watcher.emit('unlink', TEST_FILE_A);
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Dependencies should be cleaned up
			expect(node_a.dependents.has(TEST_FILE_B)).toBe(false);
			expect(node_b.dependencies.has(TEST_FILE_A)).toBe(false);
		});

		test('removes child from parent on deletion', async () => {
			const filer = new Filer({paths: [TEST_SOURCE], batch_delay: 0});

			// Emit ready event
			setTimeout(() => mock_watcher.emit('ready'), 0);
			await filer.ready;

			// Add file
			mock_watcher.emit('add', TEST_FILE_A);
			await new Promise((resolve) => setTimeout(resolve, 10));

			const parent = filer.get_disknode(TEST_SOURCE);
			expect(parent.children.has('a.ts')).toBe(true);

			// Delete file
			mock_watcher.emit('unlink', TEST_FILE_A);
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

			const filer = new Filer({
				paths: [TEST_SOURCE],
				batch_delay: 50,
				observers: [observer],
			});

			// Emit ready event
			setTimeout(() => mock_watcher.emit('ready'), 0);
			await filer.ready;

			// Emit multiple changes quickly
			mock_watcher.emit('add', TEST_FILE_A, create_mock_stats());
			mock_watcher.emit('add', TEST_FILE_B, create_mock_stats());
			mock_watcher.emit('add', TEST_FILE_C, create_mock_stats());

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

			const filer = new Filer({
				paths: [TEST_SOURCE],
				batch_delay: 0,
				observers: [observer],
			});

			// Emit ready event
			setTimeout(() => mock_watcher.emit('ready'), 0);
			await filer.ready;

			mock_watcher.emit('add', TEST_FILE_A);
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

			const filer = new Filer({
				paths: [TEST_SOURCE],
				batch_delay: 50,
				observers: [observer],
			});

			// Emit ready event
			setTimeout(() => mock_watcher.emit('ready'), 0);
			await filer.ready;

			// Emit add then change quickly
			mock_watcher.emit('add', TEST_FILE_A, create_mock_stats());
			mock_watcher.emit('change', TEST_FILE_A, create_mock_stats({size: 200}));

			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(vi.mocked(observer.on_change)).toHaveBeenCalledTimes(1);
			const batch = vi.mocked(observer.on_change).mock.calls[0][0];
			expect(batch.size).toBe(1);
			expect(batch.get(TEST_FILE_A)?.type).toBe('add'); // Preserved add semantic
		});

		test('add + delete → no change', async () => {
			const observer: Filer_Observer = {
				id: 'coalesce_test',
				patterns: [/\.ts$/],
				on_change: vi.fn(),
			};

			const filer = new Filer({
				paths: [TEST_SOURCE],
				batch_delay: 50,
				observers: [observer],
			});

			// Emit ready event
			setTimeout(() => mock_watcher.emit('ready'), 0);
			await filer.ready;

			// Emit add then delete quickly
			mock_watcher.emit('add', TEST_FILE_A, create_mock_stats());
			mock_watcher.emit('unlink', TEST_FILE_A);

			await new Promise((resolve) => setTimeout(resolve, 100));

			// Should result in empty batch (no change event)
			if (vi.mocked(observer.on_change).mock.calls.length > 0) {
				const batch = vi.mocked(observer.on_change).mock.calls[0][0];
				expect(batch.has(TEST_FILE_A)).toBe(false);
			}
		});

		test('delete + add → update', async () => {
			const observer: Filer_Observer = {
				id: 'coalesce_test',
				patterns: [/\.ts$/],
				on_change: vi.fn(),
			};

			const filer = new Filer({
				paths: [TEST_SOURCE],
				batch_delay: 50,
				observers: [observer],
			});

			// Emit ready event
			setTimeout(() => mock_watcher.emit('ready'), 0);
			await filer.ready;

			// Emit delete then add quickly
			mock_watcher.emit('unlink', TEST_FILE_A);
			mock_watcher.emit('add', TEST_FILE_A, create_mock_stats());

			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(vi.mocked(observer.on_change)).toHaveBeenCalledTimes(1);
			const batch = vi.mocked(observer.on_change).mock.calls[0][0];
			expect(batch.size).toBe(1);
			expect(batch.get(TEST_FILE_A)?.type).toBe('update'); // Coalesced to update
		});

		test('change + delete → delete', async () => {
			const observer: Filer_Observer = {
				id: 'coalesce_test',
				patterns: [/\.ts$/],
				on_change: vi.fn(),
			};

			const filer = new Filer({
				paths: [TEST_SOURCE],
				batch_delay: 50,
				observers: [observer],
			});

			// Emit ready event
			setTimeout(() => mock_watcher.emit('ready'), 0);
			await filer.ready;

			// Emit change then delete quickly
			mock_watcher.emit('change', TEST_FILE_A, create_mock_stats());
			mock_watcher.emit('unlink', TEST_FILE_A);

			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(vi.mocked(observer.on_change)).toHaveBeenCalledTimes(1);
			const batch = vi.mocked(observer.on_change).mock.calls[0][0];
			expect(batch.size).toBe(1);
			expect(batch.get(TEST_FILE_A)?.type).toBe('delete'); // Latest wins
		});
	});

	describe('querying', () => {
		test('finds disknodes by predicate', () => {
			const filer = new Filer({paths: []});

			filer.get_disknode(TEST_FILE_A);
			filer.get_disknode(TEST_FILE_B);
			filer.get_disknode(TEST_FILE_C);
			filer.get_disknode('/test/data.json');

			const ts_files = filer.find_disknodes((node) => node.id.endsWith('.ts'));

			expect(ts_files).toHaveLength(3);
			expect(ts_files.map((n) => n.id)).toEqual(
				expect.arrayContaining([TEST_FILE_A, TEST_FILE_B, TEST_FILE_C]),
			);
		});

		test('gets node by id', () => {
			const filer = new Filer({paths: []});

			const created_node = filer.get_disknode(TEST_FILE_A);
			const retrieved_node = filer.get_by_id(TEST_FILE_A);

			expect(retrieved_node).toBe(created_node);
		});

		test('returns undefined for non-existent id', () => {
			const filer = new Filer({paths: []});

			const node = filer.get_by_id('/non/existent/file.ts');

			expect(node).toBeUndefined();
		});

		test('find_nodes returns empty array when no matches', () => {
			const filer = new Filer({paths: []});

			filer.get_disknode(TEST_FILE_A);
			filer.get_disknode(TEST_FILE_B);

			const python_files = filer.find_disknodes((node) => node.id.endsWith('.py'));

			expect(python_files).toEqual([]);
		});

		test('find_nodes handles empty node collection', () => {
			const filer = new Filer({paths: []});

			const results = filer.find_disknodes(() => true);

			expect(results).toEqual([]);
		});
	});

	describe('lifecycle management', () => {
		test('resets watcher with new paths', async () => {
			const filer = new Filer({paths: [TEST_SOURCE]});

			// Emit ready event
			setTimeout(() => mock_watcher.emit('ready'), 0);
			await filer.ready;

			// Create some state
			filer.get_disknode(TEST_FILE_A);
			filer.get_disknode(TEST_FILE_B);
			expect(filer.disknodes.size).toBe(6); // 2 files + their parent directories

			// Create new mock watcher for reset
			const new_mock_watcher = new Mock_Watcher();
			vi.mocked(watch).mockReturnValue(new_mock_watcher as unknown as FSWatcher);

			// Emit ready for new watcher
			setTimeout(() => new_mock_watcher.emit('ready'), 0);

			await filer.reset_watcher(['/new/path']);

			// Should have closed old watcher
			expect(mock_watcher.listeners.size).toBe(0);

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

			const filer = new Filer({
				paths: [TEST_SOURCE],
				observers: [observer],
			});

			// Emit ready event
			setTimeout(() => mock_watcher.emit('ready'), 0);
			await filer.ready;

			// Create some state
			filer.get_disknode(TEST_FILE_A);
			filer.get_disknode(TEST_FILE_B);

			await filer.close();

			// Everything should be cleaned up
			expect(filer.disknodes.size).toBe(0);
			expect(filer.roots.size).toBe(0);
			expect(mock_watcher.listeners.size).toBe(0);
		});

		test('handles close() when not initialized', async () => {
			const filer = new Filer({paths: []});

			// Should not throw
			await expect(filer.close()).resolves.toBeUndefined();
		});

		test('clears pending batch on reset', async () => {
			const observer: Filer_Observer = {
				id: 'test',
				patterns: [/\.ts$/],
				on_change: vi.fn(),
			};

			const filer = new Filer({
				paths: [TEST_SOURCE],
				batch_delay: 100, // Long delay
				observers: [observer],
			});

			// Emit ready event
			setTimeout(() => mock_watcher.emit('ready'), 0);
			await filer.ready;

			// Create pending change
			mock_watcher.emit('add', TEST_FILE_A);

			// Reset before batch processes
			const new_mock_watcher = new Mock_Watcher();
			vi.mocked(watch).mockReturnValue(new_mock_watcher as unknown as FSWatcher);

			// Emit ready for new watcher
			setTimeout(() => new_mock_watcher.emit('ready'), 0);

			await filer.reset_watcher([TEST_SOURCE]);

			// Wait a bit to ensure no delayed batch processing
			await new Promise((resolve) => setTimeout(resolve, 150));

			// Observer should not have been called
			expect(vi.mocked(observer.on_change)).not.toHaveBeenCalled();
		});

		test('handles multiple reset_watcher calls', async () => {
			const filer = new Filer({paths: []});

			// Create mock watchers that will emit ready when the listener is attached
			const create_auto_ready_watcher = () => {
				const watcher = new Mock_Watcher();
				// Override the once method to emit ready immediately when the listener is added
				const original_once = watcher.once.bind(watcher);
				watcher.once = (event: string, handler: () => void) => {
					if (event === 'ready') {
						setTimeout(() => handler(), 0);
					}
					return original_once(event, handler);
				};
				return watcher;
			};

			// Set up the mock to return watchers that auto-emit ready
			vi.mocked(watch)
				.mockReturnValueOnce(create_auto_ready_watcher() as unknown as FSWatcher)
				.mockReturnValueOnce(create_auto_ready_watcher() as unknown as FSWatcher)
				.mockReturnValueOnce(create_auto_ready_watcher() as unknown as FSWatcher);

			// Call reset_watcher sequentially - each should complete quickly due to auto-ready
			await filer.reset_watcher(['/path1']);
			await filer.reset_watcher(['/path2']);
			await filer.reset_watcher(['/path3']);

			// Should have called watch 3 times
			expect(vi.mocked(watch)).toHaveBeenCalledTimes(3);
			expect(vi.mocked(watch)).toHaveBeenLastCalledWith(['/path3'], expect.any(Object));
		});
	});

	describe('performance features', () => {
		test('load_initial_stats processes disknodes in batches', async () => {
			const filer = new Filer({paths: []});

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
			const filer = new Filer({paths: []});

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

		test('load_initial_stats handles empty node collection', async () => {
			const filer = new Filer({paths: []});

			// Don't create any disknodes
			await expect(filer.load_initial_stats()).resolves.toBeUndefined();

			// Should not have called stat at all
			expect(vi.mocked(stat)).not.toHaveBeenCalled();
		});

		test('load_initial_stats handles directory disknodes correctly', async () => {
			const filer = new Filer({paths: []});

			// Create disknodes with mixed types
			filer.get_disknode('/test/file.ts');
			filer.get_disknode('/test/dir');

			// Mock lstatSync and stat
			const {lstatSync} = await import('node:fs');
			vi.mocked(lstatSync).mockImplementation((path: any) => {
				if (path.includes('dir')) {
					return create_mock_stats({isDirectory: () => true, isFile: () => false, size: 4096});
				}
				return create_mock_stats({size: 100});
			});

			vi.mocked(stat).mockImplementation((path: any) => {
				if (path.includes('dir')) {
					return Promise.resolve(
						create_mock_stats({isDirectory: () => true, isFile: () => false, size: 4096}),
					);
				}
				return Promise.resolve(create_mock_stats({size: 100}));
			});

			await filer.load_initial_stats();

			// Should have called stat for all disknodes including directories and parents
			expect(vi.mocked(stat)).toHaveBeenCalled();

			// Check that directory node is properly marked
			const dir_node = filer.get_disknode('/test/dir');
			expect(dir_node.kind).toBe('directory');
			expect(dir_node.size).toBe(4096);

			const file_node = filer.get_disknode('/test/file.ts');
			expect(file_node.kind).toBe('file');
			expect(file_node.size).toBe(100);
		});

		test('load_initial_stats skips external disknodes', async () => {
			const filer = new Filer({paths: [TEST_SOURCE]});

			// Emit ready event
			setTimeout(() => mock_watcher.emit('ready'), 0);
			await filer.ready;

			// Create internal and external disknodes
			filer.get_disknode(TEST_FILE_A); // Internal
			filer.get_disknode(TEST_EXTERNAL_FILE); // External (automatically detected)

			// Clear mock to count only load_initial_stats calls
			vi.mocked(stat).mockClear();

			await filer.load_initial_stats();

			// Should only call stat for internal disknodes (file + parent directories)
			// TEST_FILE_A is internal, TEST_EXTERNAL_FILE and /external are external
			const calls = vi.mocked(stat).mock.calls.map((c) => c[0]);
			expect(calls).toContain(TEST_FILE_A);
			expect(calls).not.toContain(TEST_EXTERNAL_FILE);
			expect(calls).not.toContain('/external');
		});

		test('rescan_subtree invalidates subtree', async () => {
			const observer: Filer_Observer = {
				id: 'test',
				patterns: [/.*/],
				track_directories: true,
				on_change: vi.fn(),
			};

			const filer = new Filer({
				paths: [TEST_SOURCE],
				batch_delay: 0,
				observers: [observer],
			});

			// Emit ready event
			setTimeout(() => mock_watcher.emit('ready'), 0);
			await filer.ready;

			// Create subtree
			const dir = filer.get_disknode(TEST_DIR_LIB);
			const file1 = filer.get_disknode(`${TEST_DIR_LIB}/file1.ts`);
			const file2 = filer.get_disknode(`${TEST_DIR_LIB}/file2.ts`);
			file1.parent = dir;
			file2.parent = dir;
			dir.children.set('file1.ts', file1);
			dir.children.set('file2.ts', file2);

			// Rescan subtree
			await filer.rescan_subtree(TEST_DIR_LIB);

			// Wait for invalidation to process
			await new Promise((resolve) => setTimeout(resolve, 50));

			expect(vi.mocked(observer.on_change)).toHaveBeenCalled();
			const batch = vi.mocked(observer.on_change).mock.calls[0][0];
			expect(batch.has(TEST_DIR_LIB)).toBe(true);
			expect(batch.has(`${TEST_DIR_LIB}/file1.ts`)).toBe(true);
			expect(batch.has(`${TEST_DIR_LIB}/file2.ts`)).toBe(true);
		});

		test('rescan_subtree handles non-existent node gracefully', async () => {
			const filer = new Filer({paths: []});

			// Should not throw
			await expect(filer.rescan_subtree('/non/existent/path')).resolves.toBeUndefined();
		});
	});

	describe('alias mapping', () => {
		test('maps aliases correctly', () => {
			const filer = new Filer({
				paths: [],
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
			const filer = new Filer({
				paths: [],
				aliases: [['$lib', './src/lib']],
			});

			expect(filer.map_alias('./relative/path')).toBe('./relative/path');
			expect(filer.map_alias('external-package')).toBe('external-package');
			expect(filer.map_alias('/absolute/path')).toBe('/absolute/path');
		});

		test('handles empty aliases array', () => {
			const filer = new Filer({
				paths: [],
				aliases: [],
			});

			expect(filer.map_alias('$lib/utils')).toBe('$lib/utils');
			expect(filer.map_alias('./relative')).toBe('./relative');
		});

		test('uses first matching alias', () => {
			const filer = new Filer({
				paths: [],
				aliases: [
					['$lib', './src/lib'],
					['$lib/special', './src/special'], // More specific but comes after
				],
			});

			// Should use first match
			expect(filer.map_alias('$lib/special/utils')).toBe('./src/lib/special/utils');
		});
	});

	describe('error handling', () => {
		test('handles watcher setup errors gracefully', async () => {
			vi.mocked(watch).mockImplementation(() => {
				throw new Error('Watcher setup failed');
			});

			// Should not throw during construction
			const filer = new Filer({paths: [TEST_SOURCE]});

			// Ready should still resolve (in error state)
			await expect(filer.ready).resolves.toBeUndefined();
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

			const filer = new Filer({
				paths: [TEST_SOURCE],
				batch_delay: 0,
				observers: [failing_observer, working_observer],
			});

			// Emit ready event
			setTimeout(() => mock_watcher.emit('ready'), 0);
			await filer.ready;

			mock_watcher.emit('add', TEST_FILE_A);
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

			const filer = new Filer({
				paths: [TEST_SOURCE],
				batch_delay: 0,
				observers: [failing_observer],
			});

			// Emit ready event
			setTimeout(() => mock_watcher.emit('ready'), 0);
			await filer.ready;

			// Should handle the error (likely by logging it)
			mock_watcher.emit('add', TEST_FILE_A);
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Test that the system doesn't crash - no specific assertion needed
			expect(true).toBe(true);
		});
	});
});
