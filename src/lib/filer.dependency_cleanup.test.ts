// @slop Claude Sonnet 4

import {describe, test, expect, vi} from 'vitest';

import type {Filer_Observer} from './filer_helpers.ts';
import {use_filer_test_context, create_mock_stats, TEST_PATHS} from './filer.test_helpers.ts';

// Test for dependency cleanup correctness on node deletion

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

describe('Filer Dependency Cleanup on Delete', () => {
	const ctx = use_filer_test_context();

	describe('stale dependency link prevention', () => {
		test('observers can expand to dependents before relationships are cleared', async () => {
			const batch_contents: Array<Array<string>> = [];

			const expansion_observer: Filer_Observer = {
				id: 'expansion_test',
				paths: [TEST_PATHS.FILE_A], // Only match FILE_A directly
				expand_to: 'dependents', // This should expand to include B and C via relationships
				on_change: (batch) => {
					// Record what nodes ended up in the batch due to expansion
					const batch_ids = batch.all_disknodes.map((n) => n.id).sort();
					batch_contents.push(batch_ids);
				},
			};

			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
				observers: [expansion_observer],
			});

			// Set up dependency chain: A <- B <- C
			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
			const node_c = filer.get_disknode(TEST_PATHS.FILE_C);

			node_b.add_dependency(node_a);
			node_c.add_dependency(node_b);

			// Trigger initial change to capture baseline - the expansion should include dependents
			ctx.mock_watcher.emit('change', TEST_PATHS.FILE_A, create_mock_stats());
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Delete node B (middle of chain)
			ctx.mock_watcher.emit('unlink', TEST_PATHS.FILE_B);
			await new Promise((resolve) => setTimeout(resolve, 20));

			// Trigger change on A again to test expansion after deletion
			ctx.mock_watcher.emit('change', TEST_PATHS.FILE_A, create_mock_stats());
			await new Promise((resolve) => setTimeout(resolve, 20));

			// Before deletion, expansion should include A, B, and C (A + its dependents)
			expect(batch_contents.length).toBeGreaterThanOrEqual(2);
			const initial_batch = batch_contents[0];
			expect(initial_batch).toContain(TEST_PATHS.FILE_A);
			expect(initial_batch).toContain(TEST_PATHS.FILE_B); // B is A's dependent
			expect(initial_batch).toContain(TEST_PATHS.FILE_C); // C is B's dependent (transitive from A)

			// After deletion, expansion should not include deleted B or unreachable C
			const post_deletion_batch = batch_contents[batch_contents.length - 1];
			expect(post_deletion_batch).toContain(TEST_PATHS.FILE_A);
			expect(post_deletion_batch).not.toContain(TEST_PATHS.FILE_B); // B is deleted, should not be expanded
			expect(post_deletion_batch).not.toContain(TEST_PATHS.FILE_C); // C not reachable through deleted B
		});

		test('dependency maps are completely cleaned after node deletion', async () => {
			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
			});

			// Create complex dependency web
			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
			const node_c = filer.get_disknode(TEST_PATHS.FILE_C);
			const node_d = filer.get_disknode(TEST_PATHS.FILE_D);

			// B depends on A, C depends on B, D depends on B
			node_b.add_dependency(node_a);
			node_c.add_dependency(node_b);
			node_d.add_dependency(node_b);

			// Verify initial state
			expect(node_a.dependents.size).toBe(1); // B depends on A
			expect(node_b.dependencies.size).toBe(1); // B depends on A
			expect(node_b.dependents.size).toBe(2); // C and D depend on B
			expect(node_c.dependencies.size).toBe(1); // C depends on B
			expect(node_d.dependencies.size).toBe(1); // D depends on B

			// Delete node B
			ctx.mock_watcher.emit('unlink', TEST_PATHS.FILE_B);
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Verify complete cleanup
			expect(node_a.dependents.size).toBe(0); // No longer has B as dependent
			expect(node_b.dependencies.size).toBe(0); // B's dependencies cleared
			expect(node_b.dependents.size).toBe(0); // B's dependents cleared
			expect(node_c.dependencies.size).toBe(0); // C no longer depends on B
			expect(node_d.dependencies.size).toBe(0); // D no longer depends on B

			// Verify B is marked as not existing
			expect(node_b.exists).toBe(false);

			// Verify no stale entries in relationship maps
			for (const dep of node_a.dependents.values()) {
				expect(dep.dependencies.has(node_a.id)).toBe(true);
				expect(dep.exists).toBe(true);
			}

			for (const dep of node_c.dependencies.values()) {
				expect(dep.dependents.has(node_c.id)).toBe(true);
				expect(dep.exists).toBe(true);
			}

			for (const dep of node_d.dependencies.values()) {
				expect(dep.dependents.has(node_d.id)).toBe(true);
				expect(dep.exists).toBe(true);
			}
		});

		test('relationship traversal skips deleted nodes', async () => {
			const filer = await ctx.create_mounted_filer();

			// Create dependency chain
			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
			const node_c = filer.get_disknode(TEST_PATHS.FILE_C);

			node_b.add_dependency(node_a);
			node_c.add_dependency(node_b);

			// Mark B as deleted but don't clear relationships yet (simulate race condition)
			node_b.exists = false;

			// Traverse from A to dependents - should skip B
			const dependents = Array.from(filer.get_dependents(node_a, true));

			// Should not include the deleted node B, even if relationships still exist
			expect(dependents).not.toContain(node_b);

			// Should also not include C (since path through B is broken)
			expect(dependents).not.toContain(node_c);
		});

		test('expansion strategies respect deleted node boundaries', async () => {
			const expansion_results: Array<string> = [];

			const expansion_observer: Filer_Observer = {
				id: 'expansion_test',
				paths: [TEST_PATHS.FILE_A], // Only trigger on A
				expand_to: 'dependents', // Expand to dependents
				on_change: (batch) => {
					for (const disknode of batch.all_disknodes) {
						expansion_results.push(disknode.id);
					}
				},
			};

			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
				observers: [expansion_observer],
			});

			// Create chain A <- B <- C
			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
			const node_c = filer.get_disknode(TEST_PATHS.FILE_C);

			node_b.add_dependency(node_a);
			node_c.add_dependency(node_b);

			// Delete B
			ctx.mock_watcher.emit('unlink', TEST_PATHS.FILE_B);
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Clear results
			expansion_results.length = 0;

			// Trigger change on A
			ctx.mock_watcher.emit('change', TEST_PATHS.FILE_A, create_mock_stats());
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Should include A (original) but not B (deleted) or C (unreachable through deleted B)
			expect(expansion_results).toContain(TEST_PATHS.FILE_A);
			expect(expansion_results).not.toContain(TEST_PATHS.FILE_B);
			expect(expansion_results).not.toContain(TEST_PATHS.FILE_C);
		});
	});

	describe('edge cases and race conditions', () => {
		test('handles simultaneous dependency deletion', async () => {
			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
			});

			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
			const node_c = filer.get_disknode(TEST_PATHS.FILE_C);

			// Create circular dependencies
			node_a.add_dependency(node_c);
			node_b.add_dependency(node_a);
			node_c.add_dependency(node_b);

			// Delete all nodes simultaneously
			ctx.mock_watcher.emit('unlink', TEST_PATHS.FILE_A);
			ctx.mock_watcher.emit('unlink', TEST_PATHS.FILE_B);
			ctx.mock_watcher.emit('unlink', TEST_PATHS.FILE_C);
			await new Promise((resolve) => setTimeout(resolve, 20));

			// All nodes should be cleaned up
			expect(node_a.dependencies.size).toBe(0);
			expect(node_a.dependents.size).toBe(0);
			expect(node_b.dependencies.size).toBe(0);
			expect(node_b.dependents.size).toBe(0);
			expect(node_c.dependencies.size).toBe(0);
			expect(node_c.dependents.size).toBe(0);

			// All nodes should be marked as not existing
			expect(node_a.exists).toBe(false);
			expect(node_b.exists).toBe(false);
			expect(node_c.exists).toBe(false);
		});

		test('handles deletion during traversal', async () => {
			let deletion_during_traversal = false;

			const deleting_observer: Filer_Observer = {
				id: 'deleting',
				patterns: [/a\.ts$/],
				expand_to: 'dependents',
				on_change: (batch) => {
					if (!deletion_during_traversal) {
						deletion_during_traversal = true;
						// Simulate deletion during observer execution
						batch.all_disknodes[0].exists = false; // Mark first node as deleted
					}
				},
			};

			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
				observers: [deleting_observer],
			});

			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
			node_b.add_dependency(node_a);

			// Should not crash during traversal
			ctx.mock_watcher.emit('change', TEST_PATHS.FILE_A, create_mock_stats());
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(deletion_during_traversal).toBe(true);
		});

		test('prevents memory leaks from incomplete cleanup', async () => {
			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
			});

			// Create many interdependent nodes
			const nodes = [];
			for (let i = 0; i < 50; i++) {
				nodes.push(filer.get_disknode(`/test/project/src/node${i}.ts`));
			}

			// Create web of dependencies
			for (let i = 0; i < nodes.length - 1; i++) {
				nodes[i + 1].add_dependency(nodes[i]);
				if (i > 0) {
					nodes[i].add_dependency(nodes[i - 1]);
				}
			}

			// Delete half the nodes
			for (let i = 0; i < 25; i++) {
				ctx.mock_watcher.emit('unlink', `/test/project/src/node${i}.ts`);
			}
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Count total relationships across all remaining nodes
			let total_dependencies = 0;
			let total_dependents = 0;
			let stale_references = 0;

			for (let i = 25; i < nodes.length; i++) {
				const node = nodes[i];
				total_dependencies += node.dependencies.size;
				total_dependents += node.dependents.size;

				// Check for stale references
				for (const dep of node.dependencies.values()) {
					if (!dep.exists) stale_references++;
				}
				for (const dep of node.dependents.values()) {
					if (!dep.exists) stale_references++;
				}
			}

			// Should have no stale references
			expect(stale_references).toBe(0);

			// Should have significantly fewer relationships than if cleanup failed
			expect(total_dependencies + total_dependents).toBeLessThan(50);
		});
	});
});
