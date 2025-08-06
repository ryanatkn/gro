// @slop Claude Opus 4.1

import {describe, test, expect, vi} from 'vitest';

import type {Filer_Observer} from './filer_helpers.ts';
import {Disknode} from './disknode.ts';
import {
	use_filer_test_context,
	create_mock_stats,
	TEST_PATHS,
	wait_for_batch,
} from './filer.test_helpers.ts';

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

describe('Filer Invalidation System', () => {
	const ctx = use_filer_test_context();

	describe('invalidation intents', () => {
		test('processes "all" invalidation intent', async () => {
			const intent_observer: Filer_Observer = {
				id: 'intent_source',
				paths: [TEST_PATHS.CONFIG_FILE],
				returns_intents: true,
				track_external: true,
				on_change: () => [{type: 'all'}],
			};

			const tracking_observer: Filer_Observer = {
				id: 'tracking',
				patterns: [/\.ts$/, /package\.json$/],
				track_external: true,
				on_change: vi.fn((batch) => {
					// Only validate on the second call (invalidation call)
					if (vi.mocked(tracking_observer.on_change).mock.calls.length === 2) {
						expect(batch.has(TEST_PATHS.FILE_A)).toBe(true);
						expect(batch.has(TEST_PATHS.FILE_B)).toBe(true);
						expect(batch.has(TEST_PATHS.FILE_C)).toBe(true);
						expect(batch.has(TEST_PATHS.EXTERNAL_FILE)).toBe(false); // External excluded
					}
				}),
			};

			const filer = await ctx.setup_test_filer({intent_observer, tracking_observer});

			// Create some disknodes
			filer.get_disknode(TEST_PATHS.FILE_A);
			filer.get_disknode(TEST_PATHS.FILE_B);
			filer.get_disknode(TEST_PATHS.FILE_C);
			const external = filer.get_disknode(TEST_PATHS.EXTERNAL_FILE);
			external.is_external = true;

			// Trigger config change
			ctx.mock_watcher.emit('change', TEST_PATHS.CONFIG_FILE, create_mock_stats());
			await wait_for_batch();

			// Should be called twice: once for config, once for invalidation
			expect(vi.mocked(tracking_observer.on_change)).toHaveBeenCalledTimes(2);

			const second_call = vi.mocked(tracking_observer.on_change).mock.calls[1][0];
			expect(second_call.has(TEST_PATHS.FILE_A)).toBe(true);
			expect(second_call.has(TEST_PATHS.FILE_B)).toBe(true);
			expect(second_call.has(TEST_PATHS.FILE_C)).toBe(true);
			expect(second_call.has(TEST_PATHS.EXTERNAL_FILE)).toBe(false); // External excluded
		});

		test('processes "paths" invalidation intent', async () => {
			const intent_observer: Filer_Observer = {
				id: 'intent_source',
				paths: [TEST_PATHS.CONFIG_FILE],
				returns_intents: true,
				track_external: true,
				on_change: () => [
					{
						type: 'paths',
						paths: [TEST_PATHS.FILE_B, TEST_PATHS.FILE_C],
					},
				],
			};

			const tracking_observer: Filer_Observer = {
				id: 'tracking',
				patterns: [/\.ts$/, /package\.json$/],
				track_external: true,
				on_change: vi.fn(),
			};

			const filer = await ctx.setup_test_filer({intent_observer, tracking_observer});

			// Create disknodes
			filer.get_disknode(TEST_PATHS.FILE_A);
			filer.get_disknode(TEST_PATHS.FILE_B);
			filer.get_disknode(TEST_PATHS.FILE_C);

			// Trigger config change
			ctx.mock_watcher.emit('change', TEST_PATHS.CONFIG_FILE, create_mock_stats());
			await wait_for_batch();

			expect(vi.mocked(tracking_observer.on_change)).toHaveBeenCalledTimes(2);

			const second_call = vi.mocked(tracking_observer.on_change).mock.calls[1][0];
			expect(second_call.has(TEST_PATHS.FILE_A)).toBe(false); // Not in paths intent
			expect(second_call.has(TEST_PATHS.FILE_B)).toBe(true);
			expect(second_call.has(TEST_PATHS.FILE_C)).toBe(true);
		});

		test('processes "pattern" invalidation intent', async () => {
			const intent_observer: Filer_Observer = {
				id: 'intent_source',
				paths: [TEST_PATHS.CONFIG_FILE],
				returns_intents: true,
				track_external: true,
				on_change: () => [
					{
						type: 'pattern',
						pattern: /lib/,
					},
				],
			};

			const tracking_observer: Filer_Observer = {
				id: 'tracking',
				patterns: [/.*/, /package\.json$/],
				track_directories: true,
				track_external: true,
				on_change: vi.fn(),
			};

			const filer = await ctx.setup_test_filer({intent_observer, tracking_observer});

			// Create disknodes - some with 'lib' in path
			filer.get_disknode(TEST_PATHS.FILE_A); // No 'lib'
			filer.get_disknode(TEST_PATHS.DIR_LIB); // Has 'lib'
			filer.get_disknode(TEST_PATHS.FILE_LIB_E); // Has 'lib'
			filer.get_disknode(`${TEST_PATHS.SOURCE}/other.ts`); // No 'lib'

			// Trigger config change
			ctx.mock_watcher.emit('change', TEST_PATHS.CONFIG_FILE, create_mock_stats());
			await wait_for_batch();

			expect(vi.mocked(tracking_observer.on_change)).toHaveBeenCalledTimes(2);

			const second_call = vi.mocked(tracking_observer.on_change).mock.calls[1][0];
			expect(second_call.has(TEST_PATHS.FILE_A)).toBe(false); // No 'lib' in path
			expect(second_call.has(TEST_PATHS.DIR_LIB)).toBe(true); // Has 'lib'
			expect(second_call.has(TEST_PATHS.FILE_LIB_E)).toBe(true); // Has 'lib'
			expect(second_call.has(`${TEST_PATHS.SOURCE}/other.ts`)).toBe(false); // No 'lib'
		});

		test('processes "dependents" invalidation intent', async () => {
			let target_disknode: Disknode; // eslint-disable-line prefer-const

			const intent_observer: Filer_Observer = {
				id: 'intent_source',
				paths: [TEST_PATHS.CONFIG_FILE],
				returns_intents: true,
				track_external: true,
				on_change: () => [
					{
						type: 'dependents',
						disknode: target_disknode,
					},
				],
			};

			const tracking_observer: Filer_Observer = {
				id: 'tracking',
				patterns: [/\.ts$/, /package\.json$/],
				track_external: true,
				on_change: vi.fn(),
			};

			const filer = await ctx.setup_test_filer({intent_observer, tracking_observer});

			// Set up dependency chain: A <- B <- C
			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
			const node_c = filer.get_disknode(TEST_PATHS.FILE_C);
			node_b.add_dependency(node_a);
			node_c.add_dependency(node_b);
			target_disknode = node_a;

			// Trigger config change
			ctx.mock_watcher.emit('change', TEST_PATHS.CONFIG_FILE, create_mock_stats());
			await wait_for_batch();

			expect(vi.mocked(tracking_observer.on_change)).toHaveBeenCalledTimes(2);

			const second_call = vi.mocked(tracking_observer.on_change).mock.calls[1][0];
			expect(second_call.has(TEST_PATHS.FILE_A)).toBe(false); // Target node excluded
			expect(second_call.has(TEST_PATHS.FILE_B)).toBe(true); // Direct dependent
			expect(second_call.has(TEST_PATHS.FILE_C)).toBe(true); // Transitive dependent
		});

		test('processes "dependencies" invalidation intent', async () => {
			let target_disknode: Disknode; // eslint-disable-line prefer-const

			const intent_observer: Filer_Observer = {
				id: 'intent_source',
				paths: [TEST_PATHS.CONFIG_FILE],
				returns_intents: true,
				track_external: true,
				on_change: () => [
					{
						type: 'dependencies',
						disknode: target_disknode,
					},
				],
			};

			const tracking_observer: Filer_Observer = {
				id: 'tracking',
				patterns: [/\.ts$/, /package\.json$/],
				track_external: true,
				on_change: vi.fn(),
			};

			const filer = await ctx.setup_test_filer({intent_observer, tracking_observer});

			// Set up dependency chain: A -> B -> C
			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
			const node_c = filer.get_disknode(TEST_PATHS.FILE_C);
			node_c.add_dependency(node_b);
			node_b.add_dependency(node_a);
			target_disknode = node_c;

			// Trigger config change
			ctx.mock_watcher.emit('change', TEST_PATHS.CONFIG_FILE, create_mock_stats());
			await wait_for_batch();

			expect(vi.mocked(tracking_observer.on_change)).toHaveBeenCalledTimes(2);

			const second_call = vi.mocked(tracking_observer.on_change).mock.calls[1][0];
			expect(second_call.has(TEST_PATHS.FILE_A)).toBe(true); // Transitive dependency
			expect(second_call.has(TEST_PATHS.FILE_B)).toBe(true); // Direct dependency
			expect(second_call.has(TEST_PATHS.FILE_C)).toBe(false); // Target node excluded
		});

		test('processes "subtree" invalidation intent', async () => {
			let target_disknode: Disknode; // eslint-disable-line prefer-const

			const intent_observer: Filer_Observer = {
				id: 'intent_source',
				paths: [TEST_PATHS.CONFIG_FILE],
				returns_intents: true,
				track_external: true,
				on_change: () => [
					{
						type: 'subtree',
						disknode: target_disknode,
						include_self: true,
					},
				],
			};

			const tracking_observer: Filer_Observer = {
				id: 'tracking',
				patterns: [/.*/, /package\.json$/],
				track_directories: true,
				track_external: true,
				on_change: vi.fn(),
			};

			const filer = await ctx.setup_test_filer({intent_observer, tracking_observer});

			// Create directory structure
			const lib_dir = filer.get_disknode(TEST_PATHS.DIR_LIB);
			const lib_file_e = filer.get_disknode(TEST_PATHS.FILE_LIB_E);
			const lib_file_f = filer.get_disknode(TEST_PATHS.FILE_LIB_F);
			filer.get_disknode(TEST_PATHS.FILE_A);

			// Set up parent-child relationships manually for test
			lib_file_e.parent = lib_dir;
			lib_file_f.parent = lib_dir;
			lib_dir.children.set('e.ts', lib_file_e);
			lib_dir.children.set('f.ts', lib_file_f);
			target_disknode = lib_dir;

			// Trigger config change
			ctx.mock_watcher.emit('change', TEST_PATHS.CONFIG_FILE, create_mock_stats());
			await wait_for_batch();

			expect(vi.mocked(tracking_observer.on_change)).toHaveBeenCalledTimes(2);

			const second_call = vi.mocked(tracking_observer.on_change).mock.calls[1][0];
			expect(second_call.has(TEST_PATHS.DIR_LIB)).toBe(true); // include_self: true
			expect(second_call.has(TEST_PATHS.FILE_LIB_E)).toBe(true); // Descendant
			expect(second_call.has(TEST_PATHS.FILE_LIB_F)).toBe(true); // Descendant
			expect(second_call.has(TEST_PATHS.FILE_A)).toBe(false); // Not in subtree
		});

		test('subtree intent excludes self when include_self is false', async () => {
			let target_disknode: Disknode; // eslint-disable-line prefer-const

			const intent_observer: Filer_Observer = {
				id: 'intent_source',
				paths: [TEST_PATHS.CONFIG_FILE],
				returns_intents: true,
				track_external: true,
				on_change: () => [
					{
						type: 'subtree',
						disknode: target_disknode,
						include_self: false,
					},
				],
			};

			const tracking_observer: Filer_Observer = {
				id: 'tracking',
				patterns: [/.*/, /package\.json$/],
				track_directories: true,
				track_external: true,
				on_change: vi.fn(),
			};

			const filer = await ctx.setup_test_filer({intent_observer, tracking_observer});

			// Create directory structure
			const lib_dir = filer.get_disknode(TEST_PATHS.DIR_LIB);
			const lib_file_e = filer.get_disknode(TEST_PATHS.FILE_LIB_E);
			lib_file_e.parent = lib_dir;
			lib_dir.children.set('e.ts', lib_file_e);
			target_disknode = lib_dir;

			// Trigger config change
			ctx.mock_watcher.emit('change', TEST_PATHS.CONFIG_FILE, create_mock_stats());
			await wait_for_batch();

			expect(vi.mocked(tracking_observer.on_change)).toHaveBeenCalledTimes(2);

			const second_call = vi.mocked(tracking_observer.on_change).mock.calls[1][0];
			expect(second_call.has(TEST_PATHS.DIR_LIB)).toBe(false); // include_self: false
			expect(second_call.has(TEST_PATHS.FILE_LIB_E)).toBe(true); // Descendant
		});

		test('handles multiple invalidation intents', async () => {
			const intent_observer: Filer_Observer = {
				id: 'intent_source',
				paths: [TEST_PATHS.CONFIG_FILE],
				returns_intents: true,
				track_external: true,
				on_change: () => [
					{type: 'paths', paths: [TEST_PATHS.FILE_A]},
					{type: 'paths', paths: [TEST_PATHS.FILE_B, TEST_PATHS.FILE_C]},
				],
			};

			const tracking_observer: Filer_Observer = {
				id: 'tracking',
				patterns: [/\.ts$/, /package\.json$/],
				track_external: true,
				on_change: vi.fn(),
			};

			const filer = await ctx.setup_test_filer({intent_observer, tracking_observer});

			// Create disknodes
			filer.get_disknode(TEST_PATHS.FILE_A);
			filer.get_disknode(TEST_PATHS.FILE_B);
			filer.get_disknode(TEST_PATHS.FILE_C);
			filer.get_disknode(TEST_PATHS.FILE_D);

			// Trigger config change
			ctx.mock_watcher.emit('change', TEST_PATHS.CONFIG_FILE, create_mock_stats());
			await wait_for_batch();

			expect(vi.mocked(tracking_observer.on_change)).toHaveBeenCalledTimes(2);

			const second_call = vi.mocked(tracking_observer.on_change).mock.calls[1][0];
			expect(second_call.has(TEST_PATHS.FILE_A)).toBe(true);
			expect(second_call.has(TEST_PATHS.FILE_B)).toBe(true);
			expect(second_call.has(TEST_PATHS.FILE_C)).toBe(true);
			expect(second_call.has(TEST_PATHS.FILE_D)).toBe(false); // Not in any intent
		});

		test('handles empty invalidation intents array', async () => {
			const intent_observer: Filer_Observer = {
				id: 'intent_source',
				paths: [TEST_PATHS.CONFIG_FILE],
				returns_intents: true,
				track_external: true,
				on_change: () => [], // Empty array
			};

			const tracking_observer: Filer_Observer = {
				id: 'tracking',
				patterns: [/\.ts$/, /package\.json$/],
				track_external: true,
				on_change: vi.fn(),
			};

			const filer = await ctx.setup_test_filer({intent_observer, tracking_observer});

			filer.get_disknode(TEST_PATHS.FILE_A);

			// Trigger config change
			ctx.mock_watcher.emit('change', TEST_PATHS.CONFIG_FILE, create_mock_stats());
			await wait_for_batch();

			// Should only be called once for the original config change
			expect(vi.mocked(tracking_observer.on_change)).toHaveBeenCalledTimes(1);
		});
	});

	describe('loop prevention', () => {
		test('prevents infinite loops from recursive invalidation', async () => {
			const looping_observer: Filer_Observer = {
				id: 'looping',
				patterns: [/\.ts$/],
				returns_intents: true,
				on_change: () => [
					{type: 'paths', paths: [TEST_PATHS.FILE_A]}, // Always invalidate same file
				],
			};

			const call_counter = {count: 0};
			const counting_observer: Filer_Observer = {
				id: 'counter',
				patterns: [/\.ts$/],
				on_change: () => {
					call_counter.count++;
				},
			};

			const filer = await ctx.setup_test_filer({
				intent_observer: looping_observer,
				tracking_observer: counting_observer,
			});

			filer.get_disknode(TEST_PATHS.FILE_A);

			// Trigger initial change
			ctx.mock_watcher.emit('change', TEST_PATHS.FILE_A, create_mock_stats());
			await wait_for_batch(100);

			// Should not loop infinitely - processed disknodes are tracked
			expect(call_counter.count).toBeLessThan(10);
			expect(call_counter.count).toBeGreaterThan(0);
		});

		test('prevents loops across nested invalidation rounds', async () => {
			const observer_a: Filer_Observer = {
				id: 'observer_a',
				patterns: [/a\.ts$/],
				returns_intents: true,
				on_change: () => [{type: 'paths', paths: [TEST_PATHS.FILE_B]}],
			};

			const observer_b: Filer_Observer = {
				id: 'observer_b',
				patterns: [/b\.ts$/],
				returns_intents: true,
				on_change: () => [{type: 'paths', paths: [TEST_PATHS.FILE_A]}],
			};

			const call_counter = {count: 0};
			const counting_observer: Filer_Observer = {
				id: 'counter',
				patterns: [/\.ts$/],
				on_change: () => {
					call_counter.count++;
				},
			};

			const filer = await ctx.setup_test_filer({
				intent_observer: observer_a,
				tracking_observer: counting_observer,
				other_observers: [observer_b],
			});

			filer.get_disknode(TEST_PATHS.FILE_A);
			filer.get_disknode(TEST_PATHS.FILE_B);

			// Trigger initial change
			ctx.mock_watcher.emit('change', TEST_PATHS.FILE_A, create_mock_stats());
			await wait_for_batch(100);

			// Should prevent infinite loops
			expect(call_counter.count).toBeLessThan(10);
			expect(call_counter.count).toBeGreaterThan(1); // Should process at least a few rounds
		});

		test('allows re-processing after batch is complete', async () => {
			const intent_observer: Filer_Observer = {
				id: 'intent_source',
				patterns: [/\.ts$/],
				returns_intents: true,
				on_change: () => [{type: 'paths', paths: [TEST_PATHS.FILE_B]}],
			};

			const call_counter = {count: 0};
			const counting_observer: Filer_Observer = {
				id: 'counter',
				patterns: [/\.ts$/],
				on_change: () => {
					call_counter.count++;
				},
			};

			const filer = await ctx.setup_test_filer({
				intent_observer,
				tracking_observer: counting_observer,
			});

			filer.get_disknode(TEST_PATHS.FILE_A);
			filer.get_disknode(TEST_PATHS.FILE_B);

			// First change
			ctx.mock_watcher.emit('change', TEST_PATHS.FILE_A, create_mock_stats());
			await wait_for_batch();

			const first_count = call_counter.count;

			// Second change (should be processed again)
			ctx.mock_watcher.emit('change', TEST_PATHS.FILE_A, create_mock_stats());
			await wait_for_batch();

			// Should have processed more calls
			expect(call_counter.count).toBeGreaterThan(first_count);
		});
	});

	describe('intent resolution edge cases', () => {
		test('handles intent with non-existent node', async () => {
			const intent_observer: Filer_Observer = {
				id: 'intent_source',
				paths: [TEST_PATHS.CONFIG_FILE],
				returns_intents: true,
				track_external: true,
				on_change: () => [
					{
						type: 'dependents',
						disknode: undefined as any, // Invalid node
					},
				],
			};

			const tracking_observer: Filer_Observer = {
				id: 'tracking',
				patterns: [/\.ts$/, /package\.json$/],
				track_external: true,
				on_change: vi.fn(),
			};

			const filer = await ctx.setup_test_filer({intent_observer, tracking_observer});

			filer.get_disknode(TEST_PATHS.FILE_A);

			// Should not crash
			ctx.mock_watcher.emit('change', TEST_PATHS.CONFIG_FILE, create_mock_stats());
			await wait_for_batch();

			// Should only be called once (for original change)
			expect(vi.mocked(tracking_observer.on_change)).toHaveBeenCalledTimes(1);
		});

		test('handles pattern intent with invalid regex', async () => {
			const intent_observer: Filer_Observer = {
				id: 'intent_source',
				paths: [TEST_PATHS.CONFIG_FILE],
				returns_intents: true,
				track_external: true,
				on_change: () => [
					{
						type: 'pattern',
						pattern: undefined as any, // Invalid pattern
					},
				],
			};

			const tracking_observer: Filer_Observer = {
				id: 'tracking',
				patterns: [/\.ts$/, /package\.json$/],
				track_external: true,
				on_change: vi.fn(),
			};

			const filer = await ctx.setup_test_filer({intent_observer, tracking_observer});

			filer.get_disknode(TEST_PATHS.FILE_A);

			// Should not crash
			ctx.mock_watcher.emit('change', TEST_PATHS.CONFIG_FILE, create_mock_stats());
			await wait_for_batch();

			// Should only be called once (for original change)
			expect(vi.mocked(tracking_observer.on_change)).toHaveBeenCalledTimes(1);
		});

		test('handles paths intent with non-existent paths', async () => {
			const intent_observer: Filer_Observer = {
				id: 'intent_source',
				paths: [TEST_PATHS.CONFIG_FILE],
				returns_intents: true,
				track_external: true,
				on_change: () => [
					{
						type: 'paths',
						paths: [`${TEST_PATHS.SOURCE}/non_existent.ts`], // File doesn't exist yet but is within watched paths
					},
				],
			};

			const tracking_observer: Filer_Observer = {
				id: 'tracking',
				patterns: [/\.ts$/, /package\.json$/],
				track_external: true,
				on_change: vi.fn(),
			};

			await ctx.setup_test_filer({intent_observer, tracking_observer});

			// Trigger config change
			ctx.mock_watcher.emit('change', TEST_PATHS.CONFIG_FILE, create_mock_stats());
			await wait_for_batch();

			// Should create node and process it
			expect(vi.mocked(tracking_observer.on_change)).toHaveBeenCalledTimes(2);

			const second_call = vi.mocked(tracking_observer.on_change).mock.calls[1][0];
			expect(second_call.has(`${TEST_PATHS.SOURCE}/non_existent.ts`)).toBe(true);
		});

		test('skips external disknodes in intent processing', async () => {
			const intent_observer: Filer_Observer = {
				id: 'intent_source',
				paths: [TEST_PATHS.CONFIG_FILE],
				returns_intents: true,
				track_external: true,
				on_change: () => [{type: 'all'}],
			};

			const tracking_observer: Filer_Observer = {
				id: 'tracking',
				patterns: [/.*/],
				track_external: true, // Track external in observer
				on_change: vi.fn(),
			};

			const filer = await ctx.setup_test_filer({intent_observer, tracking_observer});

			// Create internal and external disknodes
			filer.get_disknode(TEST_PATHS.FILE_A); // Internal
			const external = filer.get_disknode(TEST_PATHS.EXTERNAL_FILE); // External
			external.is_external = true;

			// Trigger config change
			ctx.mock_watcher.emit('change', TEST_PATHS.CONFIG_FILE, create_mock_stats());
			await wait_for_batch();

			expect(vi.mocked(tracking_observer.on_change)).toHaveBeenCalledTimes(2);

			const second_call = vi.mocked(tracking_observer.on_change).mock.calls[1][0];
			expect(second_call.has(TEST_PATHS.FILE_A)).toBe(true); // Internal included
			expect(second_call.has(TEST_PATHS.EXTERNAL_FILE)).toBe(false); // External excluded by intent processor
		});

		test('handles regex state correctly for global patterns in intents', async () => {
			const global_pattern = /\.ts$/g;

			const intent_observer: Filer_Observer = {
				id: 'intent_source',
				paths: [TEST_PATHS.CONFIG_FILE],
				returns_intents: true,
				track_external: true,
				on_change: () => [
					{
						type: 'pattern',
						pattern: global_pattern,
					},
				],
			};

			const tracking_observer: Filer_Observer = {
				id: 'tracking',
				patterns: [/.*/, /package\.json$/],
				track_external: true,
				on_change: vi.fn(),
			};

			const filer = await ctx.setup_test_filer({intent_observer, tracking_observer});

			// Create multiple TypeScript files
			filer.get_disknode(TEST_PATHS.FILE_A);
			filer.get_disknode(TEST_PATHS.FILE_B);
			filer.get_disknode(TEST_PATHS.FILE_C);

			// Trigger config change
			ctx.mock_watcher.emit('change', TEST_PATHS.CONFIG_FILE, create_mock_stats());
			await wait_for_batch();

			expect(vi.mocked(tracking_observer.on_change)).toHaveBeenCalledTimes(2);

			const second_call = vi.mocked(tracking_observer.on_change).mock.calls[1][0];
			// All TypeScript files should match despite global flag
			expect(second_call.has(TEST_PATHS.FILE_A)).toBe(true);
			expect(second_call.has(TEST_PATHS.FILE_B)).toBe(true);
			expect(second_call.has(TEST_PATHS.FILE_C)).toBe(true);
		});
	});

	describe('observer execution order with intents', () => {
		test('processes intents after all observers in current phase', async () => {
			const execution_order: Array<string> = [];

			const intent_observer: Filer_Observer = {
				id: 'intent_source',
				paths: [TEST_PATHS.FILE_A], // Only matches TEST_PATHS.FILE_A
				track_external: true,
				returns_intents: true,
				priority: 100, // High priority
				on_change: () => {
					execution_order.push('intent_source');
					return [{type: 'paths', paths: [TEST_PATHS.FILE_B]}];
				},
			};

			const other_observer: Filer_Observer = {
				id: 'other',
				paths: [TEST_PATHS.FILE_A], // Only matches TEST_PATHS.FILE_A
				track_external: true,
				priority: 50, // Lower priority
				on_change: () => {
					execution_order.push('other');
				},
			};

			const tracking_observer: Filer_Observer = {
				id: 'tracking',
				patterns: [/\.ts$/], // Matches all .ts files
				track_external: true,
				priority: 10, // Lowest priority
				on_change: () => {
					execution_order.push('tracking');
				},
			};

			const filer = await ctx.setup_test_filer({
				intent_observer,
				tracking_observer,
				other_observers: [other_observer],
			});

			filer.get_disknode(TEST_PATHS.FILE_A);
			filer.get_disknode(TEST_PATHS.FILE_B);

			// Trigger change
			ctx.mock_watcher.emit('change', TEST_PATHS.FILE_A, create_mock_stats());
			await wait_for_batch();

			// Should execute in priority order, then intents trigger second round
			expect(execution_order).toEqual([
				'intent_source', // First round: high priority first
				'other',
				'tracking',
				'tracking', // Second round: only observers that match invalidated files
			]);
		});

		test('intents from different phases are collected and processed together', async () => {
			const intent_observer_pre: Filer_Observer = {
				id: 'intent_pre',
				paths: [TEST_PATHS.FILE_A],
				track_external: true,
				phase: 'pre',
				returns_intents: true,
				on_change: () => [{type: 'paths', paths: [TEST_PATHS.FILE_B]}],
			};

			const intent_observer_main: Filer_Observer = {
				id: 'intent_main',
				paths: [TEST_PATHS.FILE_A],
				track_external: true,
				phase: 'main',
				returns_intents: true,
				on_change: () => [{type: 'paths', paths: [TEST_PATHS.FILE_C]}],
			};

			const tracking_observer: Filer_Observer = {
				id: 'tracking',
				patterns: [/\.ts$/],
				track_external: true,
				on_change: vi.fn(),
			};

			const filer = await ctx.setup_test_filer({
				intent_observer: intent_observer_pre,
				tracking_observer,
				other_observers: [intent_observer_main],
			});

			filer.get_disknode(TEST_PATHS.FILE_A);
			filer.get_disknode(TEST_PATHS.FILE_B);
			filer.get_disknode(TEST_PATHS.FILE_C);

			// Trigger change
			ctx.mock_watcher.emit('change', TEST_PATHS.FILE_A, create_mock_stats());
			await wait_for_batch();

			// Should be called twice: original batch + invalidation batch
			expect(vi.mocked(tracking_observer.on_change)).toHaveBeenCalledTimes(2);

			const second_call = vi.mocked(tracking_observer.on_change).mock.calls[1][0];
			// Both intents should be processed together
			expect(second_call.has(TEST_PATHS.FILE_B)).toBe(true);
			expect(second_call.has(TEST_PATHS.FILE_C)).toBe(true);
		});

		test('handles observer that returns undefined instead of array', async () => {
			const intent_observer: Filer_Observer = {
				id: 'intent_source',
				paths: [TEST_PATHS.FILE_A],
				track_external: true,
				returns_intents: true,
				on_change: () => undefined as any, // Returns undefined instead of array
			};

			const tracking_observer: Filer_Observer = {
				id: 'tracking',
				patterns: [/\.ts$/],
				track_external: true,
				on_change: vi.fn(),
			};

			const filer = await ctx.setup_test_filer({intent_observer, tracking_observer});

			filer.get_disknode(TEST_PATHS.FILE_A);

			// Should not crash
			ctx.mock_watcher.emit('change', TEST_PATHS.FILE_A, create_mock_stats());
			await wait_for_batch();

			// Should only be called once (no invalidation round)
			expect(vi.mocked(tracking_observer.on_change)).toHaveBeenCalledTimes(1);
		});

		test('processes intents in post phase after main phase observers', async () => {
			const execution_order: Array<string> = [];

			const main_observer: Filer_Observer = {
				id: 'main',
				paths: [TEST_PATHS.FILE_A],
				track_external: true,
				phase: 'main',
				on_change: () => {
					execution_order.push('main');
				},
			};

			const post_intent_observer: Filer_Observer = {
				id: 'post_intent',
				paths: [TEST_PATHS.FILE_A],
				track_external: true,
				phase: 'post',
				returns_intents: true,
				on_change: () => {
					execution_order.push('post_intent');
					return [{type: 'paths', paths: [TEST_PATHS.FILE_B]}];
				},
			};

			const tracking_observer: Filer_Observer = {
				id: 'tracking',
				patterns: [/\.ts$/],
				track_external: true,
				on_change: () => {
					execution_order.push('tracking');
				},
			};

			const filer = await ctx.setup_test_filer({
				intent_observer: main_observer,
				tracking_observer,
				other_observers: [post_intent_observer],
			});

			filer.get_disknode(TEST_PATHS.FILE_A);
			filer.get_disknode(TEST_PATHS.FILE_B);

			ctx.mock_watcher.emit('change', TEST_PATHS.FILE_A, create_mock_stats());
			await wait_for_batch();

			// Should execute main, then post, then process intents
			expect(execution_order).toEqual([
				'main',
				'tracking', // main phase
				'post_intent', // post phase
				'tracking', // invalidation round
			]);
		});
	});
});
