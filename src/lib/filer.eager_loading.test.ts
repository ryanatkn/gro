// @slop Claude Sonnet 4

import {describe, test, expect, vi} from 'vitest';

import type {Filer_Observer} from './filer_helpers.ts';
import {use_filer_test_context, TEST_PATHS, wait_for_batch} from './filer.test_helpers.ts';

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

// Let the real import parser run - we'll mock at filesystem level instead

describe('Filer Eager Loading + Expansion Integration', () => {
	const ctx = use_filer_test_context();

	test('expansion and eager loading work together correctly', async () => {
		const observer: Filer_Observer = {
			id: 'expansion_eager_loading_test',
			patterns: [/\.ts$/],
			expand_to: 'dependents',
			needs_contents: true,
			needs_imports: true,
			on_change: vi.fn(),
		};

		const filer = await ctx.create_mounted_filer({
			paths: [TEST_PATHS.SOURCE],
			batch_delay: 0,
			observers: [observer],
		});

		// Set up import-based dependency chain using file contents
		const file_contents = new Map([
			[TEST_PATHS.FILE_A, 'export const a = "value";'],
			[TEST_PATHS.FILE_B, 'import {a} from "./a.js"; export const b = a;'],
			[TEST_PATHS.FILE_C, 'import {b} from "./b.js"; export const c = b;'],
		]);
		ctx.set_file_contents(file_contents);

		// Mock specifier resolution (base is now directory path, not file path)
		vi.spyOn(filer, 'resolve_specifier').mockImplementation((specifier, base) => {
			if (specifier === './a.js' && base === TEST_PATHS.SOURCE) {
				return {path_id: TEST_PATHS.FILE_A};
			}
			if (specifier === './b.js' && base === TEST_PATHS.SOURCE) {
				return {path_id: TEST_PATHS.FILE_B};
			}
			throw new Error(`Unexpected specifier: ${specifier} from ${base}`);
		});

		const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
		const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
		const node_c = filer.get_disknode(TEST_PATHS.FILE_C);

		// Spy on loading methods that should be prewarmed
		const load_contents_spy_a = vi.spyOn(node_a, 'load_contents');
		const load_contents_spy_b = vi.spyOn(node_b, 'load_contents');
		const load_contents_spy_c = vi.spyOn(node_c, 'load_contents');
		const load_imports_spy_a = vi.spyOn(node_a, 'load_imports');
		const load_imports_spy_b = vi.spyOn(node_b, 'load_imports');
		const load_imports_spy_c = vi.spyOn(node_c, 'load_imports');

		// Trigger changes to B and C first so their imports get loaded and dependencies established
		ctx.mock_watcher.emit('change', TEST_PATHS.FILE_B);
		ctx.mock_watcher.emit('change', TEST_PATHS.FILE_C);
		await wait_for_batch(10);

		// Clear the observer calls from the setup
		vi.mocked(observer.on_change).mockClear();

		// Now trigger change to A - this should expand to include its dependents B and C
		ctx.mock_watcher.emit('change', TEST_PATHS.FILE_A);
		await wait_for_batch(10);

		// Verify observer was called with expanded batch
		expect(vi.mocked(observer.on_change)).toHaveBeenCalledTimes(1);
		const batch = vi.mocked(observer.on_change).mock.calls[0][0];
		expect(batch.size).toBe(3);
		expect(batch.has(TEST_PATHS.FILE_A)).toBe(true);
		expect(batch.has(TEST_PATHS.FILE_B)).toBe(true);
		expect(batch.has(TEST_PATHS.FILE_C)).toBe(true);

		// Verify eager loading happened for ALL nodes in the expanded batch
		expect(load_contents_spy_a).toHaveBeenCalled();
		expect(load_contents_spy_b).toHaveBeenCalled();
		expect(load_contents_spy_c).toHaveBeenCalled();
		expect(load_imports_spy_a).toHaveBeenCalled();
		expect(load_imports_spy_b).toHaveBeenCalled();
		expect(load_imports_spy_c).toHaveBeenCalled();
	});

	test('data loading only happens for nodes that match filters', async () => {
		const observer: Filer_Observer = {
			id: 'filtered_data_loading_test',
			patterns: [/\.ts$/],
			expand_to: 'dependents',
			track_external: false, // Don't track external files
			needs_contents: true,
			on_change: vi.fn(),
		};

		const filer = await ctx.create_mounted_filer({
			paths: [TEST_PATHS.SOURCE],
			batch_delay: 0,
			observers: [observer],
		});

		// Set up dependency chain with external node
		const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
		const node_external = filer.get_disknode(TEST_PATHS.EXTERNAL_FILE);
		node_external.is_external = true;
		node_external.add_dependency(node_a);

		// Spy on loading methods that should be prewarmed
		const load_contents_spy_a = vi.spyOn(node_a, 'load_contents');
		const load_contents_spy_external = vi.spyOn(node_external, 'load_contents');

		// Trigger change to A
		ctx.mock_watcher.emit('change', TEST_PATHS.FILE_A);
		await wait_for_batch(10);

		// Verify observer was called but external node was filtered out
		const batch = vi.mocked(observer.on_change).mock.calls[0][0];
		expect(batch.has(TEST_PATHS.FILE_A)).toBe(true);
		expect(batch.has(TEST_PATHS.EXTERNAL_FILE)).toBe(false);

		// Verify data loading only happened for included nodes
		expect(load_contents_spy_a).toHaveBeenCalled();
		expect(load_contents_spy_external).not.toHaveBeenCalled();
	});

	test('eager loading loads imports for all importable files regardless of observer hints', async () => {
		const minimal_observer: Filer_Observer = {
			id: 'minimal_observer_test',
			patterns: [/\.ts$/],
			// No expand_to, so observer doesn't use imports, but eager loading still loads them
			on_change: vi.fn(),
		};

		const filer = await ctx.create_mounted_filer({
			paths: [TEST_PATHS.SOURCE],
			batch_delay: 0,
			observers: [minimal_observer],
		});

		const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
		const load_imports_spy_a = vi.spyOn(node_a, 'load_imports');

		// Trigger change to A
		ctx.mock_watcher.emit('change', TEST_PATHS.FILE_A);
		await wait_for_batch(10);

		// Verify observer was called
		expect(vi.mocked(minimal_observer.on_change)).toHaveBeenCalled();
		const batch = vi.mocked(minimal_observer.on_change).mock.calls[0][0];
		expect(batch.has(TEST_PATHS.FILE_A)).toBe(true);

		// With eager loading, imports are loaded for all importable files
		expect(load_imports_spy_a).toHaveBeenCalled();
	});

	test('expand_to works with eager import loading when not explicitly disabled', async () => {
		// Set up file contents with import relationships
		const file_contents = new Map([
			[TEST_PATHS.FILE_A, 'export const a = "value";'],
			[TEST_PATHS.FILE_B, 'import {a} from "./a.js"; export const b = a;'],
		]);
		ctx.set_file_contents(file_contents);

		const auto_imports_observer: Filer_Observer = {
			id: 'auto_imports_expansion_test',
			patterns: [/\.ts$/],
			expand_to: 'dependencies', // Should expand to include dependencies
			on_change: vi.fn(),
		};

		const filer = await ctx.create_mounted_filer({
			paths: [TEST_PATHS.SOURCE],
			batch_delay: 0,
			observers: [auto_imports_observer],
		});

		const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
		const node_b = filer.get_disknode(TEST_PATHS.FILE_B);

		// Spy on imports loading methods
		const load_imports_spy_a = vi.spyOn(node_a, 'load_imports');
		const load_imports_spy_b = vi.spyOn(node_b, 'load_imports');

		// Trigger change to B first to establish its dependency on A
		ctx.mock_watcher.emit('add', TEST_PATHS.FILE_B);
		await wait_for_batch(10);

		// Clear observer calls from setup
		vi.mocked(auto_imports_observer.on_change).mockClear();

		// Trigger change to B again - this should expand to include A (dependency)
		ctx.mock_watcher.emit('change', TEST_PATHS.FILE_B);
		await wait_for_batch(10);

		// Verify expansion worked
		const batch = vi.mocked(auto_imports_observer.on_change).mock.calls[0][0];
		expect(batch.has(TEST_PATHS.FILE_B)).toBe(true); // Direct match
		expect(batch.has(TEST_PATHS.FILE_A)).toBe(true); // Expanded to dependency

		// Verify imports are loaded with eager loading regardless of observer hints
		expect(load_imports_spy_a).toHaveBeenCalled();
		expect(load_imports_spy_b).toHaveBeenCalled();
	});

	test('expand_to works with eager loading even when needs_imports: false', async () => {
		// Set up file contents with import relationships
		const file_contents = new Map([
			[TEST_PATHS.FILE_A, 'export const a = "value";'],
			[TEST_PATHS.FILE_B, 'import {a} from "./a.js"; export const b = a;'],
		]);
		ctx.set_file_contents(file_contents);

		const explicit_no_imports_observer: Filer_Observer = {
			id: 'explicit_no_imports_test',
			patterns: [/\.ts$/],
			expand_to: 'dependencies',
			needs_imports: false, // Observer doesn't need imports, but eager loading provides them
			on_change: vi.fn(),
		};

		const filer = await ctx.create_mounted_filer({
			paths: [TEST_PATHS.SOURCE],
			batch_delay: 0,
			observers: [explicit_no_imports_observer],
		});

		const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
		const node_b = filer.get_disknode(TEST_PATHS.FILE_B);

		// Spy on imports loading methods
		const load_imports_spy_a = vi.spyOn(node_a, 'load_imports');
		const load_imports_spy_b = vi.spyOn(node_b, 'load_imports');

		// Trigger change to B first to establish its dependency on A
		ctx.mock_watcher.emit('add', TEST_PATHS.FILE_B);
		await wait_for_batch(10);

		// Clear observer calls from setup
		vi.mocked(explicit_no_imports_observer.on_change).mockClear();

		// Trigger change to B again - this should expand to include A (dependency)
		ctx.mock_watcher.emit('change', TEST_PATHS.FILE_B);
		await wait_for_batch(10);

		// Verify observer was called and expansion works because dependencies exist
		const batch = vi.mocked(explicit_no_imports_observer.on_change).mock.calls[0][0];
		expect(batch.has(TEST_PATHS.FILE_B)).toBe(true); // Direct match
		expect(batch.has(TEST_PATHS.FILE_A)).toBe(true); // Expansion works because dependency exists

		// With eager loading, imports are loaded regardless of observer needs
		expect(load_imports_spy_a).toHaveBeenCalled();
		expect(load_imports_spy_b).toHaveBeenCalled();
	});

	test('returns_intents works with eager import loading when not explicitly disabled', async () => {
		const auto_imports_observer: Filer_Observer = {
			id: 'returns_intents_eager_test',
			patterns: [/\.ts$/],
			returns_intents: true, // Should auto-enable imports
			// needs_imports is undefined, so auto-enable should work
			on_change: vi.fn(() => []),
		};

		const filer = await ctx.create_mounted_filer({
			paths: [TEST_PATHS.SOURCE],
			batch_delay: 0,
			observers: [auto_imports_observer],
		});

		const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
		const load_imports_spy_a = vi.spyOn(node_a, 'load_imports');

		// Trigger change to A
		ctx.mock_watcher.emit('change', TEST_PATHS.FILE_A);
		await wait_for_batch(10);

		// Verify imports are loaded with eager loading
		expect(load_imports_spy_a).toHaveBeenCalled();
	});

	test('eager loading works even when returns_intents: true and needs_imports: false', async () => {
		const explicit_no_imports_observer: Filer_Observer = {
			id: 'explicit_no_imports_intents_test',
			patterns: [/\.ts$/],
			returns_intents: true,
			needs_imports: false, // Observer doesn't need imports, but eager loading provides them
			on_change: vi.fn(() => []),
		};

		const filer = await ctx.create_mounted_filer({
			paths: [TEST_PATHS.SOURCE],
			batch_delay: 0,
			observers: [explicit_no_imports_observer],
		});

		const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
		const load_imports_spy_a = vi.spyOn(node_a, 'load_imports');

		// Trigger change to A
		ctx.mock_watcher.emit('change', TEST_PATHS.FILE_A);
		await wait_for_batch(10);

		// With eager loading, imports are loaded regardless of observer needs
		expect(load_imports_spy_a).toHaveBeenCalled();
	});
});
