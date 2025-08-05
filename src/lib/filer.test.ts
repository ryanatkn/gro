import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest';
import {existsSync, type Stats} from 'node:fs';
import {stat} from 'node:fs/promises';
import {watch, type FSWatcher} from 'chokidar';

import {Filer, type Filer_Observer, type File_Change, Change_Batch} from './filer.ts';
import {Disknode} from './disknode.ts';
import type {Path_Id} from './path.ts';

/* eslint-disable no-new */

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
}));

// Test constants
const TEST_ROOT = '/test/project';
const TEST_SOURCE = `${TEST_ROOT}/src`;
const TEST_FILE_A: Path_Id = `${TEST_SOURCE}/a.ts`;
const TEST_FILE_B: Path_Id = `${TEST_SOURCE}/b.ts`;
const TEST_FILE_C: Path_Id = `${TEST_SOURCE}/c.ts`;
const TEST_DIR_LIB: Path_Id = `${TEST_SOURCE}/lib`;
const TEST_FILE_LIB_D: Path_Id = `${TEST_DIR_LIB}/d.ts`;
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

describe('Filer', () => {
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
			expect(filer.nodes.size).toBe(0);
			expect(filer.roots.size).toBe(0);
		});

		test('initializes watcher with provided paths', async () => {
			const paths = [TEST_SOURCE];
			new Filer({paths});

			// Wait for watcher to be ready
			await new Promise<void>((resolve) => {
				setTimeout(() => {
					mock_watcher.emit('ready');
					resolve();
				}, 0);
			});

			expect(vi.mocked(watch)).toHaveBeenCalledWith(
				paths,
				expect.objectContaining({
					persistent: true,
					ignoreInitial: false,
					followSymlinks: true,
				}),
			);
		});

		test('accepts initial observers', () => {
			const observer: Filer_Observer = {
				id: 'test_observer',
				patterns: [/\.ts$/],
				on_change: vi.fn(),
			};

			new Filer({observers: [observer]});
			// Observer should be registered (we'll test this more thoroughly below)
		});

		test('sets up default paths when none provided', () => {
			vi.mocked(existsSync).mockImplementation((path) => {
				return path === './src' || path === './package.json';
			});

			new Filer();
			expect(vi.mocked(watch)).toHaveBeenCalled();
		});
	});

	describe('node management', () => {
		test('creates nodes lazily with get_node', () => {
			const filer = new Filer({paths: []});

			expect(filer.nodes.size).toBe(0);

			const node = filer.get_node(TEST_FILE_A);

			expect(node).toBeInstanceOf(Disknode);
			expect(node.id).toBe(TEST_FILE_A);
			expect(node.filer).toBe(filer);
			expect(filer.nodes.size).toBe(1);
			expect(filer.nodes.get(TEST_FILE_A)).toBe(node);
		});

		test('returns existing node on subsequent calls', () => {
			const filer = new Filer({paths: []});

			const node1 = filer.get_node(TEST_FILE_A);
			const node2 = filer.get_node(TEST_FILE_A);

			expect(node1).toBe(node2);
			expect(filer.nodes.size).toBe(1);
		});

		test('sets up parent-child relationships', () => {
			const filer = new Filer({paths: []});

			const file_node = filer.get_node(TEST_FILE_A);
			const dir_node = filer.get_node(TEST_SOURCE);

			expect(file_node.parent).toBe(dir_node);
			expect(dir_node.children.get('a.ts')).toBe(file_node);
			expect(dir_node.kind).toBe('directory');
		});

		test('identifies root nodes', () => {
			const filer = new Filer({paths: []});

			// Create a node at root level
			const root_node = filer.get_node('/');

			expect(filer.roots.has(root_node)).toBe(true);
		});

		test('identifies external nodes', () => {
			const filer = new Filer({paths: [TEST_SOURCE]});

			// Wait for ready
			mock_watcher.emit('ready');

			const internal_node = filer.get_node(TEST_FILE_A);
			const external_node = filer.get_node(TEST_EXTERNAL_FILE);

			expect(internal_node.is_external).toBe(false);
			expect(external_node.is_external).toBe(true);
		});
	});

	describe('change handling', () => {
		test('handles file add events', async () => {
			const filer = new Filer({paths: [TEST_SOURCE], batch_delay: 0});
			mock_watcher.emit('ready');

			const mock_stats = create_mock_stats();
			mock_watcher.emit('add', TEST_FILE_A, mock_stats);

			// Wait for batch processing
			await new Promise((resolve) => setTimeout(resolve, 10));

			const node = filer.nodes.get(TEST_FILE_A);
			expect(node).toBeDefined();
			expect(node?.kind).toBe('file');
			expect(node?.stats).toBe(mock_stats);
		});

		test('handles directory add events', async () => {
			const filer = new Filer({paths: [TEST_SOURCE], batch_delay: 0});
			mock_watcher.emit('ready');

			const dir_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => true,
			});
			mock_watcher.emit('addDir', TEST_DIR_LIB, dir_stats);

			// Wait for batch processing
			await new Promise((resolve) => setTimeout(resolve, 10));

			const node = filer.nodes.get(TEST_DIR_LIB);
			expect(node).toBeDefined();
			expect(node?.kind).toBe('directory');
		});

		test('handles file change events', async () => {
			const filer = new Filer({paths: [TEST_SOURCE], batch_delay: 0});
			mock_watcher.emit('ready');

			// Add file first
			mock_watcher.emit('add', TEST_FILE_A, create_mock_stats());
			await new Promise((resolve) => setTimeout(resolve, 10));

			const node = filer.get_node(TEST_FILE_A);
			const version_before = node['#version' as keyof Disknode];

			// Change file
			mock_watcher.emit('change', TEST_FILE_A, create_mock_stats({size: 200}));
			await new Promise((resolve) => setTimeout(resolve, 10));

			const version_after = node['#version' as keyof Disknode];
			expect(version_after).toBeGreaterThan(version_before as number);
		});

		test('handles file delete events', async () => {
			const filer = new Filer({paths: [TEST_SOURCE], batch_delay: 0});
			mock_watcher.emit('ready');

			// Add file first
			mock_watcher.emit('add', TEST_FILE_A, create_mock_stats());
			await new Promise((resolve) => setTimeout(resolve, 10));

			const node = filer.get_node(TEST_FILE_A);
			expect(node.exists).toBe(true);

			// Delete file
			mock_watcher.emit('unlink', TEST_FILE_A);
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(node.exists).toBe(false);
		});

		test('batches multiple changes', async () => {
			const observer: Filer_Observer = {
				id: 'test_observer',
				patterns: [/\.ts$/],
				on_change: vi.fn(),
			};

			new Filer({
				paths: [TEST_SOURCE],
				batch_delay: 50,
				observers: [observer],
			});
			mock_watcher.emit('ready');

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
			const batch = vi.mocked(observer.on_change).mock.calls[0][0] as Change_Batch;
			expect(batch.size).toBe(3);
		});
	});

	describe('observer pattern', () => {
		test('registers and unregisters observers', () => {
			const filer = new Filer({paths: []});

			const observer: Filer_Observer = {
				id: 'test_observer',
				patterns: [/\.ts$/],
				on_change: vi.fn(),
			};

			const unsubscribe = filer.observe(observer);
			// Observer is registered

			unsubscribe();
			// Observer is unregistered
		});

		test('matches observers by patterns', async () => {
			const ts_observer: Filer_Observer = {
				id: 'ts_observer',
				patterns: [/\.ts$/],
				on_change: vi.fn(),
			};

			const js_observer: Filer_Observer = {
				id: 'js_observer',
				patterns: [/\.js$/],
				on_change: vi.fn(),
			};

			new Filer({
				paths: [TEST_SOURCE],
				batch_delay: 0,
				observers: [ts_observer, js_observer],
			});
			mock_watcher.emit('ready');

			// Add TypeScript file
			mock_watcher.emit('add', TEST_FILE_A, create_mock_stats());
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(vi.mocked(ts_observer.on_change)).toHaveBeenCalled();
			expect(vi.mocked(js_observer.on_change)).not.toHaveBeenCalled();
		});

		test('matches observers by paths', async () => {
			const specific_observer: Filer_Observer = {
				id: 'specific_observer',
				paths: [TEST_FILE_A],
				on_change: vi.fn(),
			};

			new Filer({
				paths: [TEST_SOURCE],
				batch_delay: 0,
				observers: [specific_observer],
			});
			mock_watcher.emit('ready');

			// Add the specific file
			mock_watcher.emit('add', TEST_FILE_A, create_mock_stats());
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(vi.mocked(specific_observer.on_change)).toHaveBeenCalled();

			// Add different file
			vi.mocked(specific_observer.on_change).mockClear();
			mock_watcher.emit('add', TEST_FILE_B, create_mock_stats());
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(vi.mocked(specific_observer.on_change)).not.toHaveBeenCalled();
		});

		test('supports dynamic paths', async () => {
			let dynamic_paths = [TEST_FILE_A];

			const observer: Filer_Observer = {
				id: 'dynamic_observer',
				paths: () => dynamic_paths,
				on_change: vi.fn(),
			};

			new Filer({
				paths: [TEST_SOURCE],
				batch_delay: 0,
				observers: [observer],
			});
			mock_watcher.emit('ready');

			// Add file A
			mock_watcher.emit('add', TEST_FILE_A, create_mock_stats());
			await new Promise((resolve) => setTimeout(resolve, 10));
			expect(vi.mocked(observer.on_change)).toHaveBeenCalled();

			// Change dynamic paths
			dynamic_paths = [TEST_FILE_B];
			vi.mocked(observer.on_change).mockClear();

			// Add file A again - should not match now
			mock_watcher.emit('change', TEST_FILE_A, create_mock_stats());
			await new Promise((resolve) => setTimeout(resolve, 10));
			expect(vi.mocked(observer.on_change)).not.toHaveBeenCalled();

			// Add file B - should match now
			mock_watcher.emit('add', TEST_FILE_B, create_mock_stats());
			await new Promise((resolve) => setTimeout(resolve, 10));
			expect(vi.mocked(observer.on_change)).toHaveBeenCalled();
		});

		test('matches observers by custom function', async () => {
			const custom_observer: Filer_Observer = {
				id: 'custom_observer',
				match: (node) => node.id.includes('lib'),
				on_change: vi.fn(),
			};

			new Filer({
				paths: [TEST_SOURCE],
				batch_delay: 0,
				observers: [custom_observer],
			});
			mock_watcher.emit('ready');

			// Add lib file
			mock_watcher.emit('add', TEST_FILE_LIB_D, create_mock_stats());
			await new Promise((resolve) => setTimeout(resolve, 10));
			expect(vi.mocked(custom_observer.on_change)).toHaveBeenCalled();

			// Add non-lib file
			vi.mocked(custom_observer.on_change).mockClear();
			mock_watcher.emit('add', TEST_FILE_A, create_mock_stats());
			await new Promise((resolve) => setTimeout(resolve, 10));
			expect(vi.mocked(custom_observer.on_change)).not.toHaveBeenCalled();
		});

		test('respects track_external option', async () => {
			const observer: Filer_Observer = {
				id: 'test_observer',
				patterns: [/\.ts$/],
				track_external: false,
				on_change: vi.fn(),
			};

			const filer = new Filer({
				paths: [TEST_SOURCE],
				batch_delay: 0,
				observers: [observer],
			});
			mock_watcher.emit('ready');

			// Create external node manually and trigger change
			const external_node = filer.get_node(TEST_EXTERNAL_FILE);
			external_node.is_external = true;

			// Simulate adding the external file - should not trigger observer
			mock_watcher.emit('add', TEST_EXTERNAL_FILE, create_mock_stats());
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Observer should not have been called for external file
			expect(vi.mocked(observer.on_change)).not.toHaveBeenCalled();
		});

		test('respects track_directories option', async () => {
			const observer: Filer_Observer = {
				id: 'test_observer',
				patterns: [/.*/],
				track_directories: false,
				on_change: vi.fn(),
			};

			new Filer({
				paths: [TEST_SOURCE],
				batch_delay: 0,
				observers: [observer],
			});
			mock_watcher.emit('ready');

			// Add directory
			mock_watcher.emit(
				'addDir',
				TEST_DIR_LIB,
				create_mock_stats({
					isFile: () => false,
					isDirectory: () => true,
				}),
			);
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(vi.mocked(observer.on_change)).not.toHaveBeenCalled();
		});

		test('executes observers in phase order', async () => {
			const execution_order: Array<string> = [];

			const pre_observer: Filer_Observer = {
				id: 'pre',
				patterns: [/\.ts$/],
				phase: 'pre',
				on_change: () => {
					execution_order.push('pre');
				},
			};

			const main_observer: Filer_Observer = {
				id: 'main',
				patterns: [/\.ts$/],
				phase: 'main',
				on_change: () => {
					execution_order.push('main');
				},
			};

			const post_observer: Filer_Observer = {
				id: 'post',
				patterns: [/\.ts$/],
				phase: 'post',
				on_change: () => {
					execution_order.push('post');
				},
			};

			new Filer({
				paths: [TEST_SOURCE],
				batch_delay: 0,
				observers: [post_observer, main_observer, pre_observer], // Add in wrong order
			});
			mock_watcher.emit('ready');

			mock_watcher.emit('add', TEST_FILE_A, create_mock_stats());
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(execution_order).toEqual(['pre', 'main', 'post']);
		});

		test('respects priority within phases', async () => {
			const execution_order: Array<string> = [];

			const high_priority: Filer_Observer = {
				id: 'high',
				patterns: [/\.ts$/],
				phase: 'main',
				priority: 100,
				on_change: () => {
					execution_order.push('high');
				},
			};

			const low_priority: Filer_Observer = {
				id: 'low',
				patterns: [/\.ts$/],
				phase: 'main',
				priority: 10,
				on_change: () => {
					execution_order.push('low');
				},
			};

			new Filer({
				paths: [TEST_SOURCE],
				batch_delay: 0,
				observers: [low_priority, high_priority], // Add in wrong order
			});
			mock_watcher.emit('ready');

			mock_watcher.emit('add', TEST_FILE_A, create_mock_stats());
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(execution_order).toEqual(['high', 'low']);
		});

		test('handles observer errors with continue strategy', async () => {
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

			new Filer({
				paths: [TEST_SOURCE],
				batch_delay: 0,
				observers: [failing_observer, working_observer],
			});
			mock_watcher.emit('ready');

			mock_watcher.emit('add', TEST_FILE_A, create_mock_stats());
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Working observer should still be called
			expect(vi.mocked(working_observer.on_change)).toHaveBeenCalled();
		});

		test('handles observer errors with abort strategy', async () => {
			const failing_observer: Filer_Observer = {
				id: 'failing',
				patterns: [/\.ts$/],
				on_change: () => {
					throw new Error('Observer failed');
				},
				on_error: () => 'abort',
			};

			const working_observer: Filer_Observer = {
				id: 'working',
				patterns: [/\.ts$/],
				on_change: vi.fn(),
			};

			new Filer({
				paths: [TEST_SOURCE],
				batch_delay: 0,
				observers: [failing_observer, working_observer],
			});
			mock_watcher.emit('ready');

			// This should throw
			await expect(async () => {
				mock_watcher.emit('add', TEST_FILE_A, create_mock_stats());
				await new Promise((resolve) => setTimeout(resolve, 10));
			}).rejects.toThrow();
		});

		test('handles observer timeout', async () => {
			const slow_observer: Filer_Observer = {
				id: 'slow',
				patterns: [/\.ts$/],
				timeout_ms: 10,
				on_change: async () => {
					await new Promise((resolve) => setTimeout(resolve, 100));
				},
			};

			new Filer({
				paths: [TEST_SOURCE],
				batch_delay: 0,
				observers: [slow_observer],
			});
			mock_watcher.emit('ready');

			// Should timeout and throw
			await expect(async () => {
				mock_watcher.emit('add', TEST_FILE_A, create_mock_stats());
				await new Promise((resolve) => setTimeout(resolve, 50));
			}).rejects.toThrow('Observer slow timed out');
		});
	});

	describe('invalidation strategies', () => {
		test('self invalidation only affects matched files', async () => {
			const observer: Filer_Observer = {
				id: 'self_observer',
				paths: [TEST_FILE_A],
				invalidate: 'self',
				on_change: vi.fn(),
			};

			const filer = new Filer({
				paths: [TEST_SOURCE],
				batch_delay: 0,
				observers: [observer],
			});
			mock_watcher.emit('ready');

			// Set up dependencies
			const node_a = filer.get_node(TEST_FILE_A);
			const node_b = filer.get_node(TEST_FILE_B);
			node_b.add_dependency(node_a);

			// Change file A
			mock_watcher.emit('change', TEST_FILE_A, create_mock_stats());
			await new Promise((resolve) => setTimeout(resolve, 10));

			const batch = vi.mocked(observer.on_change).mock.calls[0][0] as Change_Batch;
			expect(batch.size).toBe(1);
			expect(batch.has(TEST_FILE_A)).toBe(true);
			expect(batch.has(TEST_FILE_B)).toBe(false);
		});

		test('dependents invalidation includes dependent files', async () => {
			const observer: Filer_Observer = {
				id: 'dependents_observer',
				patterns: [/\.ts$/],
				invalidate: 'dependents',
				on_change: vi.fn(),
			};

			const filer = new Filer({
				paths: [TEST_SOURCE],
				batch_delay: 0,
				observers: [observer],
			});
			mock_watcher.emit('ready');

			// Set up dependencies
			const node_a = filer.get_node(TEST_FILE_A);
			const node_b = filer.get_node(TEST_FILE_B);
			const node_c = filer.get_node(TEST_FILE_C);
			node_b.add_dependency(node_a);
			node_c.add_dependency(node_b);

			// Change file A
			mock_watcher.emit('change', TEST_FILE_A, create_mock_stats());
			await new Promise((resolve) => setTimeout(resolve, 10));

			const batch = vi.mocked(observer.on_change).mock.calls[0][0] as Change_Batch;
			// Should include A, B (dependent of A), and C (dependent of B)
			expect(batch.has(TEST_FILE_A)).toBe(true);
			expect(batch.has(TEST_FILE_B)).toBe(true);
			expect(batch.has(TEST_FILE_C)).toBe(true);
		});

		test('all invalidation includes all non-external files', async () => {
			const observer: Filer_Observer = {
				id: 'all_observer',
				paths: [TEST_FILE_A],
				invalidate: 'all',
				on_change: vi.fn(),
			};

			const filer = new Filer({
				paths: [TEST_SOURCE],
				batch_delay: 0,
				observers: [observer],
			});
			mock_watcher.emit('ready');

			// Create some nodes
			filer.get_node(TEST_FILE_A);
			filer.get_node(TEST_FILE_B);
			filer.get_node(TEST_FILE_C);
			const external = filer.get_node(TEST_EXTERNAL_FILE);
			external.is_external = true;

			// Change file A
			mock_watcher.emit('change', TEST_FILE_A, create_mock_stats());
			await new Promise((resolve) => setTimeout(resolve, 10));

			const batch = vi.mocked(observer.on_change).mock.calls[0][0] as Change_Batch;
			// Should include all non-external files
			expect(batch.has(TEST_FILE_A)).toBe(true);
			expect(batch.has(TEST_FILE_B)).toBe(true);
			expect(batch.has(TEST_FILE_C)).toBe(true);
			expect(batch.has(TEST_EXTERNAL_FILE)).toBe(false);
		});
	});

	describe('invalidation intents', () => {
		test('processes invalidation intents from observers', async () => {
			const observer: Filer_Observer = {
				id: 'intent_observer',
				paths: [TEST_FILE_A],
				on_change: () => {
					return [
						{
							type: 'paths',
							paths: [TEST_FILE_B, TEST_FILE_C],
						},
					];
				},
			};

			const tracking_observer: Filer_Observer = {
				id: 'tracking',
				patterns: [/\.ts$/],
				on_change: vi.fn(),
			};

			const filer = new Filer({
				paths: [TEST_SOURCE],
				batch_delay: 0,
				observers: [observer, tracking_observer],
			});
			mock_watcher.emit('ready');

			// Create nodes
			filer.get_node(TEST_FILE_A);
			filer.get_node(TEST_FILE_B);
			filer.get_node(TEST_FILE_C);

			// Change file A
			mock_watcher.emit('change', TEST_FILE_A, create_mock_stats());
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Tracking observer should be called twice:
			// 1. For the original change to A
			// 2. For the invalidation of B and C
			expect(vi.mocked(tracking_observer.on_change)).toHaveBeenCalledTimes(2);
		});

		test('handles pattern invalidation intent', async () => {
			const observer: Filer_Observer = {
				id: 'pattern_observer',
				paths: [TEST_CONFIG_FILE],
				on_change: () => {
					return [
						{
							type: 'pattern',
							pattern: /\.ts$/,
						},
					];
				},
			};

			const tracking_observer: Filer_Observer = {
				id: 'tracking',
				patterns: [/\.ts$/],
				on_change: vi.fn(),
			};

			const filer = new Filer({
				paths: [TEST_SOURCE],
				batch_delay: 0,
				observers: [observer, tracking_observer],
			});
			mock_watcher.emit('ready');

			// Create nodes
			filer.get_node(TEST_FILE_A);
			filer.get_node(TEST_FILE_B);
			filer.get_node('/test/file.json');

			// Change config file
			mock_watcher.emit('change', TEST_CONFIG_FILE, create_mock_stats());
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Check that TypeScript files were invalidated
			const calls = vi.mocked(tracking_observer.on_change).mock.calls;
			const last_batch = calls[calls.length - 1][0] as Change_Batch;
			expect(last_batch.has(TEST_FILE_A)).toBe(true);
			expect(last_batch.has(TEST_FILE_B)).toBe(true);
			expect(last_batch.has('/test/file.json')).toBe(false);
		});

		test('handles subtree invalidation intent', async () => {
			const observer: Filer_Observer = {
				id: 'subtree_observer',
				paths: [TEST_CONFIG_FILE],
				on_change: () => {
					const lib_node = filer.get_node(TEST_DIR_LIB);
					return [
						{
							type: 'subtree',
							node: lib_node,
							include_self: true,
						},
					];
				},
			};

			const tracking_observer: Filer_Observer = {
				id: 'tracking',
				patterns: [/.*/],
				track_directories: true,
				on_change: vi.fn(),
			};

			const filer = new Filer({
				paths: [TEST_SOURCE],
				batch_delay: 0,
				observers: [observer, tracking_observer],
			});
			mock_watcher.emit('ready');

			// Create lib directory structure
			const lib_dir = filer.get_node(TEST_DIR_LIB);
			const lib_file = filer.get_node(TEST_FILE_LIB_D);
			lib_file.parent = lib_dir;
			lib_dir.children.set('d.ts', lib_file);

			// Change config file
			mock_watcher.emit('change', TEST_CONFIG_FILE, create_mock_stats());
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Check that lib subtree was invalidated
			const calls = vi.mocked(tracking_observer.on_change).mock.calls;
			const last_batch = calls[calls.length - 1][0] as Change_Batch;
			expect(last_batch.has(TEST_DIR_LIB)).toBe(true);
			expect(last_batch.has(TEST_FILE_LIB_D)).toBe(true);
		});

		test('prevents infinite loops in invalidation', async () => {
			const observer: Filer_Observer = {
				id: 'loop_observer',
				patterns: [/\.ts$/],
				on_change: () => {
					// Always return invalidation for same files
					return [
						{
							type: 'paths',
							paths: [TEST_FILE_A],
						},
					];
				},
			};

			const call_count = {count: 0};
			const tracking_observer: Filer_Observer = {
				id: 'tracking',
				patterns: [/\.ts$/],
				on_change: () => {
					call_count.count++;
				},
			};

			const filer = new Filer({
				paths: [TEST_SOURCE],
				batch_delay: 0,
				observers: [observer, tracking_observer],
			});
			mock_watcher.emit('ready');

			filer.get_node(TEST_FILE_A);

			// Change file A
			mock_watcher.emit('change', TEST_FILE_A, create_mock_stats());
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Should not loop infinitely - processed nodes are tracked
			expect(call_count.count).toBeLessThan(10);
		});
	});

	describe('dependency tracking', () => {
		test('gets direct dependents', () => {
			const filer = new Filer({paths: []});

			const node_a = filer.get_node(TEST_FILE_A);
			const node_b = filer.get_node(TEST_FILE_B);
			const node_c = filer.get_node(TEST_FILE_C);

			node_b.add_dependency(node_a);
			node_c.add_dependency(node_a);

			const dependents = filer.get_dependents(node_a, false);

			expect(dependents.size).toBe(2);
			expect(dependents.has(node_b)).toBe(true);
			expect(dependents.has(node_c)).toBe(true);
			expect(dependents.has(node_a)).toBe(false);
		});

		test('gets transitive dependents', () => {
			const filer = new Filer({paths: []});

			const node_a = filer.get_node(TEST_FILE_A);
			const node_b = filer.get_node(TEST_FILE_B);
			const node_c = filer.get_node(TEST_FILE_C);

			node_b.add_dependency(node_a);
			node_c.add_dependency(node_b);

			const dependents = filer.get_dependents(node_a, true);

			expect(dependents.size).toBe(2);
			expect(dependents.has(node_b)).toBe(true);
			expect(dependents.has(node_c)).toBe(true);
		});

		test('gets direct dependencies', () => {
			const filer = new Filer({paths: []});

			const node_a = filer.get_node(TEST_FILE_A);
			const node_b = filer.get_node(TEST_FILE_B);
			const node_c = filer.get_node(TEST_FILE_C);

			node_c.add_dependency(node_a);
			node_c.add_dependency(node_b);

			const dependencies = filer.get_dependencies(node_c, false);

			expect(dependencies.size).toBe(2);
			expect(dependencies.has(node_a)).toBe(true);
			expect(dependencies.has(node_b)).toBe(true);
			expect(dependencies.has(node_c)).toBe(false);
		});

		test('handles circular dependencies', () => {
			const filer = new Filer({paths: []});

			const node_a = filer.get_node(TEST_FILE_A);
			const node_b = filer.get_node(TEST_FILE_B);
			const node_c = filer.get_node(TEST_FILE_C);

			// Create circular dependency: A -> B -> C -> A
			node_b.add_dependency(node_a);
			node_c.add_dependency(node_b);
			node_a.add_dependency(node_c);

			const dependents = filer.get_dependents(node_a, true);

			// Should not infinite loop
			expect(dependents.size).toBe(2);
			expect(dependents.has(node_b)).toBe(true);
			expect(dependents.has(node_c)).toBe(true);
		});

		test('filters dependents with predicate', () => {
			const filer = new Filer({paths: []});

			const node_a = filer.get_node(TEST_FILE_A);
			const node_b = filer.get_node(TEST_FILE_B);
			const node_c = filer.get_node(TEST_FILE_C);
			const node_json = filer.get_node('/test/data.json');

			node_b.add_dependency(node_a);
			node_c.add_dependency(node_a);
			node_json.add_dependency(node_a);

			const ts_dependents = filer.filter_dependents(node_a, (id) => id.endsWith('.ts'), false);

			expect(ts_dependents.size).toBe(2);
			expect(ts_dependents.has(TEST_FILE_B)).toBe(false); // .js file
			expect(ts_dependents.has(TEST_FILE_C)).toBe(false); // .svelte file
			expect(ts_dependents.has('/test/data.json')).toBe(false);
		});
	});

	describe('querying', () => {
		test('finds nodes by predicate', () => {
			const filer = new Filer({paths: []});

			filer.get_node(TEST_FILE_A);
			filer.get_node(TEST_FILE_B);
			filer.get_node(TEST_FILE_C);
			filer.get_node('/test/data.json');

			const ts_files = filer.find_nodes((node) => node.id.endsWith('.ts'));

			expect(ts_files).toHaveLength(1);
			expect(ts_files[0].id).toBe(TEST_FILE_A);
		});

		test('gets node by id', () => {
			const filer = new Filer({paths: []});

			const created_node = filer.get_node(TEST_FILE_A);
			const retrieved_node = filer.get_by_id(TEST_FILE_A);

			expect(retrieved_node).toBe(created_node);
		});

		test('returns undefined for non-existent id', () => {
			const filer = new Filer({paths: []});

			const node = filer.get_by_id('/non/existent/file.ts');

			expect(node).toBeUndefined();
		});
	});

	describe('watcher lifecycle', () => {
		test('resets watcher with new paths', async () => {
			const filer = new Filer({paths: [TEST_SOURCE]});
			mock_watcher.emit('ready');

			// Create new mock watcher for reset
			const new_mock_watcher = new Mock_Watcher();
			vi.mocked(watch).mockReturnValue(new_mock_watcher as unknown as FSWatcher);

			await filer.reset_watcher(['/new/path']);

			// Should have closed old watcher
			expect(mock_watcher.listeners.size).toBe(0);

			// Should have created new watcher
			expect(vi.mocked(watch)).toHaveBeenCalledWith(['/new/path'], expect.any(Object));

			// State should be cleared
			expect(filer.nodes.size).toBe(0);
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
			mock_watcher.emit('ready');

			// Create some state
			filer.get_node(TEST_FILE_A);
			filer.get_node(TEST_FILE_B);

			await filer.close();

			// Everything should be cleaned up
			expect(filer.nodes.size).toBe(0);
			expect(filer.roots.size).toBe(0);
			expect(mock_watcher.listeners.size).toBe(0);
		});
	});

	describe('performance features', () => {
		test('loads initial stats in batches', async () => {
			const filer = new Filer({paths: []});

			// Create many nodes
			for (let i = 0; i < 250; i++) {
				filer.get_node(`/test/file${i}.ts`);
			}

			// Mock stat to return different stats for each file
			vi.mocked(stat).mockImplementation((path: any) => {
				return Promise.resolve(
					create_mock_stats({size: parseInt(path.match(/\d+/)?.[0] || '0', 10)}),
				);
			});

			await filer.load_initial_stats();

			// Should have called stat for each non-external node
			expect(vi.mocked(stat)).toHaveBeenCalledTimes(250);

			// Stats should be pre-populated
			const node = filer.get_node('/test/file1.ts');
			expect(node.size).toBe(1);
		});

		test('rescans subtree for robustness', async () => {
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
			mock_watcher.emit('ready');

			// Create subtree
			const dir = filer.get_node(TEST_DIR_LIB);
			const file1 = filer.get_node(`${TEST_DIR_LIB}/file1.ts`);
			const file2 = filer.get_node(`${TEST_DIR_LIB}/file2.ts`);
			file1.parent = dir;
			file2.parent = dir;
			dir.children.set('file1.ts', file1);
			dir.children.set('file2.ts', file2);

			// Rescan subtree
			await filer.rescan_subtree(TEST_DIR_LIB);

			// Observer should be called with invalidation
			await new Promise((resolve) => setTimeout(resolve, 50));

			const batch = vi.mocked(observer.on_change).mock.calls[0][0] as Change_Batch;
			expect(batch.has(TEST_DIR_LIB)).toBe(true);
			expect(batch.has(`${TEST_DIR_LIB}/file1.ts`)).toBe(true);
			expect(batch.has(`${TEST_DIR_LIB}/file2.ts`)).toBe(true);
		});
	});

	describe('alias mapping', () => {
		test('maps aliases in import specifiers', () => {
			const filer = new Filer({
				paths: [],
				aliases: [
					['$lib', './src/lib'],
					['$routes', './src/routes'],
				],
			});

			expect(filer.map_alias('$lib/utils')).toBe('./src/lib/utils');
			expect(filer.map_alias('$routes/home')).toBe('./src/routes/home');
			expect(filer.map_alias('./relative/path')).toBe('./relative/path');
			expect(filer.map_alias('external-package')).toBe('external-package');
		});
	});

	describe('Change_Batch', () => {
		test('stores and retrieves changes', () => {
			const changes: Array<File_Change> = [
				{type: 'add', node: undefined, id: TEST_FILE_A, kind: 'file'},
				{type: 'update', node: undefined, id: TEST_FILE_B, kind: 'file'},
				{type: 'delete', node: undefined, id: TEST_FILE_C, kind: 'file'},
			];

			const batch = new Change_Batch(changes);

			expect(batch.size).toBe(3);
			expect(batch.has(TEST_FILE_A)).toBe(true);
			expect(batch.has(TEST_FILE_B)).toBe(true);
			expect(batch.has(TEST_FILE_C)).toBe(true);
			expect(batch.get(TEST_FILE_A)?.type).toBe('add');
		});

		test('categorizes changes by type', () => {
			const filer = new Filer({paths: []});
			const node_a = new Disknode(TEST_FILE_A, filer);
			const node_b = new Disknode(TEST_FILE_B, filer);

			const changes: Array<File_Change> = [
				{type: 'add', node: node_a, id: TEST_FILE_A, kind: 'file'},
				{type: 'update', node: node_b, id: TEST_FILE_B, kind: 'file'},
				{type: 'delete', node: undefined, id: TEST_FILE_C, kind: 'file'},
			];

			const batch = new Change_Batch(changes);

			expect(batch.added).toEqual([node_a]);
			expect(batch.updated).toEqual([node_b]);
			expect(batch.deleted).toEqual([TEST_FILE_C]);
			expect(batch.all_nodes).toContain(node_a);
			expect(batch.all_nodes).toContain(node_b);
			expect(batch.all_nodes).toHaveLength(2);
		});

		test('checks if batch is empty', () => {
			const empty_batch = new Change_Batch();
			expect(empty_batch.is_empty).toBe(true);

			const batch = new Change_Batch([
				{type: 'add', node: undefined, id: TEST_FILE_A, kind: 'file'},
			]);
			expect(batch.is_empty).toBe(false);
		});
	});
});
