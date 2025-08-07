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

// Mock the synchronous parse_imports function used when workers are disabled
vi.mock('./parse_imports.ts', () => ({
	parse_imports: vi.fn().mockReturnValue([]),
}));

describe('Filer Prewarm + Expansion Integration', () => {
	const ctx = use_filer_test_context();

	test('expansion and prewarm work together correctly', async () => {
		const observer: Filer_Observer = {
			id: 'expansion_prewarm_test',
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

		// Set up dependency chain: A <- B <- C
		const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
		const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
		const node_c = filer.get_disknode(TEST_PATHS.FILE_C);
		node_b.add_dependency(node_a);
		node_c.add_dependency(node_b);

		// Spy on loading methods that should be prewarmed
		const load_contents_spy_a = vi.spyOn(node_a, 'load_contents');
		const load_contents_spy_b = vi.spyOn(node_b, 'load_contents');
		const load_contents_spy_c = vi.spyOn(node_c, 'load_contents');
		const load_imports_spy_a = vi.spyOn(node_a, 'load_imports');
		const load_imports_spy_b = vi.spyOn(node_b, 'load_imports');
		const load_imports_spy_c = vi.spyOn(node_c, 'load_imports');

		// Trigger change to A - this should expand to include B and C
		ctx.mock_watcher.emit('change', TEST_PATHS.FILE_A);
		await wait_for_batch(10);

		// Verify observer was called with expanded batch
		expect(vi.mocked(observer.on_change)).toHaveBeenCalledTimes(1);
		const batch = vi.mocked(observer.on_change).mock.calls[0][0];
		expect(batch.size).toBe(3);
		expect(batch.has(TEST_PATHS.FILE_A)).toBe(true);
		expect(batch.has(TEST_PATHS.FILE_B)).toBe(true);
		expect(batch.has(TEST_PATHS.FILE_C)).toBe(true);

		// Verify prewarm happened for ALL nodes in the expanded batch
		expect(load_contents_spy_a).toHaveBeenCalled();
		expect(load_contents_spy_b).toHaveBeenCalled();
		expect(load_contents_spy_c).toHaveBeenCalled();
		expect(load_imports_spy_a).toHaveBeenCalled();
		expect(load_imports_spy_b).toHaveBeenCalled();
		expect(load_imports_spy_c).toHaveBeenCalled();
	});

	test('prewarm only happens for nodes that match filters', async () => {
		const observer: Filer_Observer = {
			id: 'filtered_prewarm_test',
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

		// Verify prewarm only happened for included nodes
		expect(load_contents_spy_a).toHaveBeenCalled();
		expect(load_contents_spy_external).not.toHaveBeenCalled();
	});

	test('prewarm respects observer performance hints', async () => {
		const minimal_observer: Filer_Observer = {
			id: 'minimal_prewarm_test',
			patterns: [/\.ts$/],
			expand_to: 'dependents',
			needs_contents: false,
			needs_stats: false,
			needs_imports: false,
			on_change: vi.fn(),
		};

		const filer = await ctx.create_mounted_filer({
			paths: [TEST_PATHS.SOURCE],
			batch_delay: 0,
			observers: [minimal_observer],
		});

		// Set up dependency chain
		const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
		const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
		node_b.add_dependency(node_a);

		// Spy on loading methods that should be prewarmed
		const load_contents_spy_a = vi.spyOn(node_a, 'load_contents');
		const load_contents_spy_b = vi.spyOn(node_b, 'load_contents');
		const load_stats_spy_a = vi.spyOn(node_a, 'load_stats');
		const load_stats_spy_b = vi.spyOn(node_b, 'load_stats');
		const load_imports_spy_a = vi.spyOn(node_a, 'load_imports');
		const load_imports_spy_b = vi.spyOn(node_b, 'load_imports');

		// Trigger change to A
		ctx.mock_watcher.emit('change', TEST_PATHS.FILE_A);
		await wait_for_batch(10);

		// Verify expansion worked
		const batch = vi.mocked(minimal_observer.on_change).mock.calls[0][0];
		expect(batch.has(TEST_PATHS.FILE_A)).toBe(true);
		expect(batch.has(TEST_PATHS.FILE_B)).toBe(true);

		// Verify NO prewarm happened since observer doesn't need any data
		expect(load_contents_spy_a).not.toHaveBeenCalled();
		expect(load_contents_spy_b).not.toHaveBeenCalled();
		expect(load_stats_spy_a).not.toHaveBeenCalled();
		expect(load_stats_spy_b).not.toHaveBeenCalled();
		expect(load_imports_spy_a).not.toHaveBeenCalled();
		expect(load_imports_spy_b).not.toHaveBeenCalled();
	});

	test('expand_to automatically enables imports prewarm when not explicitly disabled', async () => {
		const auto_imports_observer: Filer_Observer = {
			id: 'auto_imports_prewarm_test',
			patterns: [/\.ts$/],
			expand_to: 'dependencies', // Should auto-enable imports
			// needs_imports is undefined, so auto-enable should work
			on_change: vi.fn(),
		};

		const filer = await ctx.create_mounted_filer({
			paths: [TEST_PATHS.SOURCE],
			batch_delay: 0,
			observers: [auto_imports_observer],
		});

		// Set up dependency chain
		const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
		const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
		node_a.add_dependency(node_b);

		// Spy on imports loading methods
		const load_imports_spy_a = vi.spyOn(node_a, 'load_imports');
		const load_imports_spy_b = vi.spyOn(node_b, 'load_imports');

		// Trigger change to A
		ctx.mock_watcher.emit('change', TEST_PATHS.FILE_A);
		await wait_for_batch(10);

		// Verify expansion worked
		const batch = vi.mocked(auto_imports_observer.on_change).mock.calls[0][0];
		expect(batch.has(TEST_PATHS.FILE_A)).toBe(true);
		expect(batch.has(TEST_PATHS.FILE_B)).toBe(true);

		// Verify imports prewarm happened because expand_to: 'dependencies' auto-enables it
		expect(load_imports_spy_a).toHaveBeenCalled();
		expect(load_imports_spy_b).toHaveBeenCalled();
	});

	test('expand_to respects explicit needs_imports: false', async () => {
		const explicit_no_imports_observer: Filer_Observer = {
			id: 'explicit_no_imports_test',
			patterns: [/\.ts$/],
			expand_to: 'dependencies',
			needs_imports: false, // Explicitly disabled - should not auto-enable
			on_change: vi.fn(),
		};

		const filer = await ctx.create_mounted_filer({
			paths: [TEST_PATHS.SOURCE],
			batch_delay: 0,
			observers: [explicit_no_imports_observer],
		});

		// Set up dependency chain
		const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
		const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
		node_a.add_dependency(node_b);

		// Spy on imports loading methods
		const load_imports_spy_a = vi.spyOn(node_a, 'load_imports');
		const load_imports_spy_b = vi.spyOn(node_b, 'load_imports');

		// Trigger change to A
		ctx.mock_watcher.emit('change', TEST_PATHS.FILE_A);
		await wait_for_batch(10);

		// Verify expansion worked
		const batch = vi.mocked(explicit_no_imports_observer.on_change).mock.calls[0][0];
		expect(batch.has(TEST_PATHS.FILE_A)).toBe(true);
		expect(batch.has(TEST_PATHS.FILE_B)).toBe(true);

		// Verify imports prewarm did NOT happen because needs_imports: false overrides auto-enable
		expect(load_imports_spy_a).not.toHaveBeenCalled();
		expect(load_imports_spy_b).not.toHaveBeenCalled();
	});

	test('returns_intents auto-enables imports prewarm when not explicitly disabled', async () => {
		const auto_imports_observer: Filer_Observer = {
			id: 'auto_imports_intents_test',
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

		// Verify imports prewarm happened because returns_intents: true auto-enables it
		expect(load_imports_spy_a).toHaveBeenCalled();
	});

	test('returns_intents respects explicit needs_imports: false', async () => {
		const explicit_no_imports_observer: Filer_Observer = {
			id: 'explicit_no_imports_intents_test',
			patterns: [/\.ts$/],
			returns_intents: true,
			needs_imports: false, // Explicitly disabled - should not auto-enable
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

		// Verify imports prewarm did NOT happen because needs_imports: false overrides auto-enable
		expect(load_imports_spy_a).not.toHaveBeenCalled();
	});
});
