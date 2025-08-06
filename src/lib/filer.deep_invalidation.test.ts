// @slop Claude Sonnet 4

import {describe, test, expect, vi} from 'vitest';

import type {Filer_Observer} from './filer_helpers.ts';
import {use_filer_test_context, TEST_PATHS, wait_for_batch} from './filer.test_helpers.ts';

// Test for deep invalidation chains to ensure iterative processing prevents stack overflow

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

describe('Filer Deep Invalidation Processing', () => {
	const ctx = use_filer_test_context();

	test('handles very deep invalidation chains without stack overflow', async () => {
		const call_log: Array<string> = [];
		let chain_depth = 0;

		const intent_observer: Filer_Observer = {
			id: 'deep_chain_observer',
			patterns: [/\.ts$/],
			returns_intents: true,
			track_external: true,
			on_change: (batch) => {
				const batch_files = Array.from(batch.changes.keys()).sort();
				call_log.push(`batch-${chain_depth}: ${batch_files.join(',')}`);

				// Create a chain of invalidation intents up to depth 100
				if (chain_depth < 100) {
					chain_depth++;
					const next_file = `/test/project/src/chain${chain_depth}.ts`;
					return [{type: 'paths', paths: [next_file]}];
				}
				return [];
			},
		};

		const tracking_observer: Filer_Observer = {
			id: 'tracking',
			patterns: [/\.ts$/],
			track_external: true,
			on_change: vi.fn(),
		};

		const filer = await ctx.setup_test_filer({
			intent_observer,
			tracking_observer,
		});

		// Create disknodes for the chain
		for (let i = 0; i <= 100; i++) {
			const path = i === 0 ? TEST_PATHS.FILE_A : `/test/project/src/chain${i}.ts`;
			filer.get_disknode(path);
		}

		// Trigger the deep chain
		ctx.mock_watcher.emit('change', TEST_PATHS.FILE_A);
		await wait_for_batch(200);

		// Should handle all 101 levels without stack overflow
		expect(chain_depth).toBe(100);
		expect(call_log.length).toBe(101); // Initial + 100 chain levels
		expect(vi.mocked(tracking_observer.on_change)).toHaveBeenCalledTimes(101);

		// First batch should contain the initial file
		expect(call_log[0]).toContain(TEST_PATHS.FILE_A);
		// Last batch should contain the final chain file
		expect(call_log[100]).toContain('chain100.ts');
	});

	test('handles complex invalidation graph without infinite loops', async () => {
		const call_counter = {count: 0};
		const processed_files: Set<string> = new Set();

		// Create a more complex invalidation pattern that could potentially loop
		const graph_observer: Filer_Observer = {
			id: 'graph_observer',
			patterns: [/[abcde]\.ts$/], // Fixed pattern to match a.ts, b.ts, c.ts, etc.
			returns_intents: true,
			track_external: true,
			on_change: (batch) => {
				call_counter.count++;

				// Track which files we've processed
				for (const change of batch.changes.values()) {
					processed_files.add(change.id);
				}

				const intents = [];

				// Create a complex invalidation pattern
				if (batch.has(TEST_PATHS.FILE_A)) {
					intents.push({type: 'paths' as const, paths: [TEST_PATHS.FILE_B, TEST_PATHS.FILE_C]});
				}
				if (batch.has(TEST_PATHS.FILE_B)) {
					intents.push({type: 'paths' as const, paths: [TEST_PATHS.FILE_C, TEST_PATHS.FILE_D]});
				}
				if (batch.has(TEST_PATHS.FILE_C)) {
					intents.push({type: 'paths' as const, paths: [TEST_PATHS.FILE_D, TEST_PATHS.FILE_E]});
				}

				return intents;
			},
		};

		const tracking_observer: Filer_Observer = {
			id: 'tracking',
			patterns: [/\.ts$/],
			track_external: true,
			on_change: vi.fn(),
		};

		const filer = await ctx.setup_test_filer({
			intent_observer: graph_observer,
			tracking_observer,
		});

		// Create disknodes
		[
			TEST_PATHS.FILE_A,
			TEST_PATHS.FILE_B,
			TEST_PATHS.FILE_C,
			TEST_PATHS.FILE_D,
			TEST_PATHS.FILE_E,
		].forEach((path) => {
			filer.get_disknode(path);
		});

		// Trigger the complex invalidation
		ctx.mock_watcher.emit('change', TEST_PATHS.FILE_A);
		await wait_for_batch(100);

		// Should not loop infinitely due to processed tracking
		expect(call_counter.count).toBeLessThan(20); // Reasonable upper bound
		expect(call_counter.count).toBe(3); // Should process exactly 3 rounds: A -> B,C -> D,E

		// Should have processed all files in the graph
		expect(processed_files.has(TEST_PATHS.FILE_A)).toBe(true);
		expect(processed_files.has(TEST_PATHS.FILE_B)).toBe(true);
		expect(processed_files.has(TEST_PATHS.FILE_C)).toBe(true);
		expect(processed_files.has(TEST_PATHS.FILE_D)).toBe(true);
		expect(processed_files.has(TEST_PATHS.FILE_E)).toBe(true);
	});

	test('handles large subtree invalidation efficiently', async () => {
		const subtree_observer: Filer_Observer = {
			id: 'subtree_observer',
			patterns: [/.*/], // Match everything including directories
			track_directories: true,
			track_external: true,
			on_change: vi.fn(),
		};

		const filer = await ctx.create_mounted_filer({
			paths: [TEST_PATHS.SOURCE],
			batch_delay: 0,
			observers: [subtree_observer],
		});

		// Create a large directory structure
		const lib_dir = filer.get_disknode(TEST_PATHS.DIR_LIB);
		lib_dir.kind = 'directory';

		const files: Array<string> = [];
		for (let i = 0; i < 500; i++) {
			const file_path = `/test/project/src/lib/file${i}.ts`;
			const file_node = filer.get_disknode(file_path);
			file_node.parent = lib_dir;
			lib_dir.children.set(`file${i}.ts`, file_node);
			files.push(file_path);
		}

		const start_time = Date.now();

		// Trigger subtree invalidation
		await filer.rescan_subtree(TEST_PATHS.DIR_LIB);
		await wait_for_batch(100);

		const end_time = Date.now();
		const duration = end_time - start_time;

		// Should complete within reasonable time (not exponential)
		expect(duration).toBeLessThan(1000); // Less than 1 second

		// Should have been called once with all files in subtree
		expect(vi.mocked(subtree_observer.on_change)).toHaveBeenCalledTimes(1);
		const batch = vi.mocked(subtree_observer.on_change).mock.calls[0][0];
		expect(batch.has(TEST_PATHS.DIR_LIB)).toBe(true); // include_self: true

		// Should include all files in the subtree
		let files_in_batch = 0;
		for (const file_path of files) {
			if (batch.has(file_path)) {
				files_in_batch++;
			}
		}
		expect(files_in_batch).toBe(500);
	});

	test('breadth-first processing order for invalidation chains', async () => {
		const processing_order: Array<string> = [];

		const bfs_observer: Filer_Observer = {
			id: 'bfs_observer',
			patterns: [/[abcdefg]\.ts$/], // Match a.ts through g.ts
			returns_intents: true,
			track_external: true,
			on_change: (batch) => {
				const files = Array.from(batch.changes.keys()).sort();
				processing_order.push(files.join(','));

				// Create a tree structure:
				// A triggers B,C
				// B triggers D,E
				// C triggers F,G
				const intents = [];

				if (batch.has(TEST_PATHS.FILE_A)) {
					intents.push({type: 'paths' as const, paths: [TEST_PATHS.FILE_B, TEST_PATHS.FILE_C]});
				}
				if (batch.has(TEST_PATHS.FILE_B)) {
					intents.push({type: 'paths' as const, paths: [TEST_PATHS.FILE_D, TEST_PATHS.FILE_E]});
				}
				if (batch.has(TEST_PATHS.FILE_C)) {
					intents.push({
						type: 'paths' as const,
						paths: [`${TEST_PATHS.SOURCE}/f.ts`, `${TEST_PATHS.SOURCE}/g.ts`],
					});
				}

				return intents;
			},
		};

		const tracking_observer: Filer_Observer = {
			id: 'tracking',
			patterns: [/\.ts$/],
			track_external: true,
			on_change: vi.fn(),
		};

		const filer = await ctx.setup_test_filer({
			intent_observer: bfs_observer,
			tracking_observer,
		});

		// Create all disknodes
		const all_files = [
			TEST_PATHS.FILE_A,
			TEST_PATHS.FILE_B,
			TEST_PATHS.FILE_C,
			TEST_PATHS.FILE_D,
			TEST_PATHS.FILE_E,
			`${TEST_PATHS.SOURCE}/f.ts`,
			`${TEST_PATHS.SOURCE}/g.ts`,
		];
		all_files.forEach((path) => filer.get_disknode(path));

		// Trigger the tree invalidation
		ctx.mock_watcher.emit('change', TEST_PATHS.FILE_A);
		await wait_for_batch(100);

		// Should process in breadth-first order:
		// Level 0: A
		// Level 1: B, C (triggered by A)
		// Level 2: D, E, F, G (all triggered by B and C in same round)
		expect(processing_order.length).toBe(3);
		expect(processing_order[0]).toContain('a.ts'); // Level 0
		// Level 1 should contain both B and C in same batch
		expect(processing_order[1]).toContain('b.ts');
		expect(processing_order[1]).toContain('c.ts');
		// Level 2 should contain all files triggered by B and C
		expect(processing_order[2]).toContain('d.ts');
		expect(processing_order[2]).toContain('e.ts');
		expect(processing_order[2]).toContain('f.ts');
		expect(processing_order[2]).toContain('g.ts');
	});
});
