// @slop Claude Opus 4.1

import {describe, test, expect, vi} from 'vitest';

import {use_filer_test_context, TEST_PATHS} from './filer.test_helpers.ts';

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

describe('Filer Dependency Tracking', () => {
	const ctx = use_filer_test_context();

	describe('direct dependencies', () => {
		test('tracks immediate dependencies only', async () => {
			const filer = await ctx.create_mounted_filer();

			// Set up dependency chain: A -> B -> C
			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
			const node_c = filer.get_disknode(TEST_PATHS.FILE_C);

			node_c.add_dependency(node_b);
			node_b.add_dependency(node_a);

			const dependencies = filer.get_dependencies(node_c, false);

			expect(dependencies.size).toBe(1);
			expect(dependencies.has(node_b)).toBe(true);
			expect(dependencies.has(node_a)).toBe(false); // Not direct
			expect(dependencies.has(node_c)).toBe(false); // Self excluded
		});

		test('handles multiple direct dependencies', async () => {
			const filer = await ctx.create_mounted_filer();

			// Set up multiple dependencies: A, B -> C
			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
			const node_c = filer.get_disknode(TEST_PATHS.FILE_C);
			const node_d = filer.get_disknode(TEST_PATHS.FILE_D);

			node_c.add_dependency(node_a);
			node_c.add_dependency(node_b);

			const dependencies = filer.get_dependencies(node_c, false);

			expect(dependencies.size).toBe(2);
			expect(dependencies.has(node_a)).toBe(true);
			expect(dependencies.has(node_b)).toBe(true);
			expect(dependencies.has(node_c)).toBe(false); // Self excluded
			expect(dependencies.has(node_d)).toBe(false); // Not a dependency
		});

		test('returns empty set when no dependencies', async () => {
			const filer = await ctx.create_mounted_filer();

			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);

			const dependencies = filer.get_dependencies(node_a, false);

			expect(dependencies.size).toBe(0);
		});
	});

	describe('recursive dependencies', () => {
		test('tracks full dependency chain', async () => {
			const filer = await ctx.create_mounted_filer();

			// Set up dependency chain: A -> B -> C -> D
			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
			const node_c = filer.get_disknode(TEST_PATHS.FILE_C);
			const node_d = filer.get_disknode(TEST_PATHS.FILE_D);

			node_d.add_dependency(node_c);
			node_c.add_dependency(node_b);
			node_b.add_dependency(node_a);

			const dependencies = filer.get_dependencies(node_d, true);

			expect(dependencies.size).toBe(3);
			expect(dependencies.has(node_a)).toBe(true);
			expect(dependencies.has(node_b)).toBe(true);
			expect(dependencies.has(node_c)).toBe(true);
			expect(dependencies.has(node_d)).toBe(false); // Self excluded
		});

		test('handles diamond dependency pattern', async () => {
			const filer = await ctx.create_mounted_filer();

			// Set up diamond: A -> B,C -> D
			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
			const node_c = filer.get_disknode(TEST_PATHS.FILE_C);
			const node_d = filer.get_disknode(TEST_PATHS.FILE_D);

			node_d.add_dependency(node_b);
			node_d.add_dependency(node_c);
			node_b.add_dependency(node_a);
			node_c.add_dependency(node_a);

			const dependencies = filer.get_dependencies(node_d, true);

			expect(dependencies.size).toBe(3);
			expect(dependencies.has(node_a)).toBe(true);
			expect(dependencies.has(node_b)).toBe(true);
			expect(dependencies.has(node_c)).toBe(true);
		});

		test('handles circular dependencies without infinite loop', async () => {
			const filer = await ctx.create_mounted_filer();

			// Set up circular: A -> B -> C -> A
			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
			const node_c = filer.get_disknode(TEST_PATHS.FILE_C);

			node_a.add_dependency(node_c);
			node_c.add_dependency(node_b);
			node_b.add_dependency(node_a);

			const dependencies = filer.get_dependencies(node_a, true);

			expect(dependencies.size).toBe(2); // B and C, not A itself
			expect(dependencies.has(node_a)).toBe(false); // Self excluded
			expect(dependencies.has(node_b)).toBe(true);
			expect(dependencies.has(node_c)).toBe(true);
		});
	});

	describe('direct dependents', () => {
		test('tracks immediate dependents only', async () => {
			const filer = await ctx.create_mounted_filer();

			// Set up dependent chain: C -> B -> A
			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
			const node_c = filer.get_disknode(TEST_PATHS.FILE_C);

			node_b.add_dependency(node_a);
			node_c.add_dependency(node_b);

			const dependents = filer.get_dependents(node_a, false);

			expect(dependents.size).toBe(1);
			expect(dependents.has(node_b)).toBe(true);
			expect(dependents.has(node_c)).toBe(false); // Not direct
			expect(dependents.has(node_a)).toBe(false); // Self excluded
		});

		test('handles multiple direct dependents', async () => {
			const filer = await ctx.create_mounted_filer();

			// Set up multiple dependents: A <- B, C
			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
			const node_c = filer.get_disknode(TEST_PATHS.FILE_C);
			const node_d = filer.get_disknode(TEST_PATHS.FILE_D);

			node_b.add_dependency(node_a);
			node_c.add_dependency(node_a);

			const dependents = filer.get_dependents(node_a, false);

			expect(dependents.size).toBe(2);
			expect(dependents.has(node_b)).toBe(true);
			expect(dependents.has(node_c)).toBe(true);
			expect(dependents.has(node_a)).toBe(false); // Self excluded
			expect(dependents.has(node_d)).toBe(false); // Not a dependent
		});

		test('returns empty set when no dependents', async () => {
			const filer = await ctx.create_mounted_filer();

			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);

			const dependents = filer.get_dependents(node_a, false);

			expect(dependents.size).toBe(0);
		});
	});

	describe('recursive dependents', () => {
		test('tracks full dependent chain', async () => {
			const filer = await ctx.create_mounted_filer();

			// Set up dependent chain: D -> C -> B -> A
			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
			const node_c = filer.get_disknode(TEST_PATHS.FILE_C);
			const node_d = filer.get_disknode(TEST_PATHS.FILE_D);

			node_b.add_dependency(node_a);
			node_c.add_dependency(node_b);
			node_d.add_dependency(node_c);

			const dependents = filer.get_dependents(node_a, true);

			expect(dependents.size).toBe(3);
			expect(dependents.has(node_b)).toBe(true);
			expect(dependents.has(node_c)).toBe(true);
			expect(dependents.has(node_d)).toBe(true);
			expect(dependents.has(node_a)).toBe(false); // Self excluded
		});

		test('handles inverted diamond dependency pattern', async () => {
			const filer = await ctx.create_mounted_filer();

			// Set up inverted diamond: D <- B,C <- A
			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
			const node_c = filer.get_disknode(TEST_PATHS.FILE_C);
			const node_d = filer.get_disknode(TEST_PATHS.FILE_D);

			node_b.add_dependency(node_a);
			node_c.add_dependency(node_a);
			node_d.add_dependency(node_b);
			node_d.add_dependency(node_c);

			const dependents = filer.get_dependents(node_a, true);

			expect(dependents.size).toBe(3);
			expect(dependents.has(node_b)).toBe(true);
			expect(dependents.has(node_c)).toBe(true);
			expect(dependents.has(node_d)).toBe(true);
		});

		test('handles circular dependents without infinite loop', async () => {
			const filer = await ctx.create_mounted_filer();

			// Set up circular: A -> B -> C -> A
			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
			const node_c = filer.get_disknode(TEST_PATHS.FILE_C);

			node_b.add_dependency(node_a);
			node_c.add_dependency(node_b);
			node_a.add_dependency(node_c);

			const dependents = filer.get_dependents(node_a, true);

			expect(dependents.size).toBe(2); // B and C, not A itself
			expect(dependents.has(node_a)).toBe(false); // Self excluded
			expect(dependents.has(node_b)).toBe(true);
			expect(dependents.has(node_c)).toBe(true);
		});
	});

	describe('filtered dependents', () => {
		test('filters by predicate function', async () => {
			const filer = await ctx.create_mounted_filer();

			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
			const node_c = filer.get_disknode(TEST_PATHS.FILE_C);
			const node_d = filer.get_disknode(TEST_PATHS.FILE_D);

			node_b.add_dependency(node_a);
			node_c.add_dependency(node_a);
			node_d.add_dependency(node_a);

			const filtered = filer.filter_dependents(
				node_a,
				(id) => id === TEST_PATHS.FILE_B || id === TEST_PATHS.FILE_C,
			);

			expect(filtered.size).toBe(2);
			expect(filtered.has(TEST_PATHS.FILE_B)).toBe(true);
			expect(filtered.has(TEST_PATHS.FILE_C)).toBe(true);
			expect(filtered.has(TEST_PATHS.FILE_D)).toBe(false);
		});

		test('works with transitive dependents', async () => {
			const filer = await ctx.create_mounted_filer();

			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
			const node_c = filer.get_disknode(TEST_PATHS.FILE_C);
			const node_d = filer.get_disknode(TEST_PATHS.FILE_D);

			node_b.add_dependency(node_a);
			node_c.add_dependency(node_b);
			node_d.add_dependency(node_c);

			const filtered = filer.filter_dependents(
				node_a,
				(id) => id === TEST_PATHS.FILE_C || id === TEST_PATHS.FILE_D,
			);

			expect(filtered.size).toBe(2);
			expect(filtered.has(TEST_PATHS.FILE_C)).toBe(true);
			expect(filtered.has(TEST_PATHS.FILE_D)).toBe(true);
		});

		test('returns empty set when no matches', async () => {
			const filer = await ctx.create_mounted_filer();

			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);

			node_b.add_dependency(node_a);

			const filtered = filer.filter_dependents(node_a, (id) => id.includes('nonexistent'));

			expect(filtered.size).toBe(0);
		});

		test('returns all dependents when no filter provided', async () => {
			const filer = await ctx.create_mounted_filer();

			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
			const node_c = filer.get_disknode(TEST_PATHS.FILE_C);

			node_b.add_dependency(node_a);
			node_c.add_dependency(node_a);

			const all_dependents = filer.filter_dependents(node_a);

			expect(all_dependents.size).toBe(2);
			expect(all_dependents.has(TEST_PATHS.FILE_B)).toBe(true);
			expect(all_dependents.has(TEST_PATHS.FILE_C)).toBe(true);
		});

		test('handles complex predicate logic', async () => {
			const filer = await ctx.create_mounted_filer();

			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
			const node_c = filer.get_disknode(TEST_PATHS.FILE_C);
			const node_d = filer.get_disknode(TEST_PATHS.FILE_D);

			node_b.add_dependency(node_a);
			node_c.add_dependency(node_a);
			node_d.add_dependency(node_a);

			// Complex predicate: contains 'b' OR ends with 'd.ts'
			const complex_filtered = filer.filter_dependents(
				node_a,
				(id) => id.includes('b') || id.endsWith('d.ts'),
			);

			expect(complex_filtered.size).toBe(2);
			expect(complex_filtered.has(TEST_PATHS.FILE_B)).toBe(true);
			expect(complex_filtered.has(TEST_PATHS.FILE_D)).toBe(true);
			expect(complex_filtered.has(TEST_PATHS.FILE_C)).toBe(false);
		});
	});

	describe('dependency graph operations', () => {
		test('add_dependency creates bidirectional links', async () => {
			const filer = await ctx.create_mounted_filer();

			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);

			node_b.add_dependency(node_a);

			expect(node_b.dependencies.has(TEST_PATHS.FILE_A)).toBe(true);
			expect(node_a.dependents.has(TEST_PATHS.FILE_B)).toBe(true);
		});

		test('remove_dependency cleans up bidirectional links', async () => {
			const filer = await ctx.create_mounted_filer();

			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);

			node_b.add_dependency(node_a);
			node_b.remove_dependency(node_a);

			expect(node_b.dependencies.has(TEST_PATHS.FILE_A)).toBe(false);
			expect(node_a.dependents.has(TEST_PATHS.FILE_B)).toBe(false);
		});

		test('adding duplicate dependency is idempotent', async () => {
			const filer = await ctx.create_mounted_filer();

			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);

			node_b.add_dependency(node_a);
			node_b.add_dependency(node_a); // Add again

			expect(node_b.dependencies.size).toBe(1);
			expect(node_a.dependents.size).toBe(1);
		});

		test('removing non-existent dependency is safe', async () => {
			const filer = await ctx.create_mounted_filer();

			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);

			// Should not throw
			expect(() => node_b.remove_dependency(node_a)).not.toThrow();

			expect(node_b.dependencies.size).toBe(0);
			expect(node_a.dependents.size).toBe(0);
		});
	});

	describe('performance and stress tests', () => {
		test('handles large dependency graphs efficiently', async () => {
			const filer = await ctx.create_mounted_filer();

			const root = filer.get_disknode(TEST_PATHS.FILE_A);

			// Create 10 levels of dependencies
			let current = root;
			for (let i = 0; i < 10; i++) {
				const next = filer.get_disknode(`/test/level_${i}.ts`);
				next.add_dependency(current);
				current = next;
			}

			const dependents = filer.get_dependents(root, true);

			expect(dependents.size).toBe(10);
		});

		test('handles deep dependency chains', async () => {
			const filer = await ctx.create_mounted_filer();

			// Create deep chain
			const nodes: Array<any> = [];
			for (let i = 0; i < 50; i++) {
				nodes.push(filer.get_disknode(`/test/deep_${i}.ts`));
			}

			// Chain them together
			for (let i = 1; i < nodes.length; i++) {
				nodes[i].add_dependency(nodes[i - 1]);
			}

			const dependents = filer.get_dependents(nodes[0], true);

			expect(dependents.size).toBe(49);
		});

		test('handles mixed internal and external dependencies', async () => {
			const filer = await ctx.create_mounted_filer();

			const internal_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const internal_b = filer.get_disknode(TEST_PATHS.FILE_B);
			const external = filer.get_disknode(TEST_PATHS.EXTERNAL_FILE);

			internal_b.add_dependency(internal_a);
			internal_b.add_dependency(external);

			const dependencies = filer.get_dependencies(internal_b);

			expect(dependencies.size).toBe(2);
			expect(dependencies.has(internal_a)).toBe(true);
			expect(dependencies.has(external)).toBe(true);
		});

		test('direct dependency updates are reflected immediately', async () => {
			const filer = await ctx.create_mounted_filer();

			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
			const node_c = filer.get_disknode(TEST_PATHS.FILE_C);

			// Add initial dependencies
			node_b.add_dependency(node_a);

			expect(filer.get_dependencies(node_b, false).size).toBe(1); // Direct dependencies only
			expect(filer.get_dependents(node_a, false).size).toBe(1); // Direct dependents only

			// Add more dependencies
			node_c.add_dependency(node_b);

			expect(filer.get_dependencies(node_c, false).size).toBe(1); // Direct dependencies only
			expect(filer.get_dependents(node_b, false).size).toBe(1); // Direct dependents only

			// Remove dependency
			node_c.remove_dependency(node_b);

			expect(filer.get_dependencies(node_c, false).size).toBe(0);
			expect(filer.get_dependents(node_b, false).size).toBe(0);
		});

		test('transitive dependency updates are reflected immediately', async () => {
			const filer = await ctx.create_mounted_filer();

			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
			const node_c = filer.get_disknode(TEST_PATHS.FILE_C);

			// Build chain: A -> B -> C
			node_b.add_dependency(node_a);
			node_c.add_dependency(node_b);

			// Check transitive dependencies
			expect(filer.get_dependencies(node_c, true).size).toBe(2); // B and A (transitive)
			expect(filer.get_dependents(node_a, true).size).toBe(2); // B and C (transitive)

			// Remove middle dependency - should break transitive chain
			node_c.remove_dependency(node_b);

			expect(filer.get_dependencies(node_c, true).size).toBe(0);
			expect(filer.get_dependents(node_a, true).size).toBe(1); // Only B remains
		});

		test('mixed direct and transitive dependencies work independently', async () => {
			const filer = await ctx.create_mounted_filer();

			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
			const node_c = filer.get_disknode(TEST_PATHS.FILE_C);
			const node_d = filer.get_disknode(TEST_PATHS.FILE_D);

			// Create both direct and transitive paths: A -> B -> C, and A -> D
			node_b.add_dependency(node_a);
			node_c.add_dependency(node_b);
			node_d.add_dependency(node_a); // Direct from A to D

			// Check mixed relationships
			expect(filer.get_dependencies(node_c, false).size).toBe(1); // Direct: only B
			expect(filer.get_dependencies(node_c, true).size).toBe(2); // Transitive: B and A
			expect(filer.get_dependents(node_a, false).size).toBe(2); // Direct: B and D
			expect(filer.get_dependents(node_a, true).size).toBe(3); // Transitive: B, C, and D

			// Remove transitive connection, direct should remain
			node_c.remove_dependency(node_b);

			expect(filer.get_dependents(node_a, false).size).toBe(2); // Still B and D
			expect(filer.get_dependents(node_a, true).size).toBe(2); // Now just B and D
		});

		test('handles self-dependencies gracefully', async () => {
			const filer = await ctx.create_mounted_filer();

			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);

			// Should handle self-dependency without issues
			node_a.add_dependency(node_a);

			const dependencies = filer.get_dependencies(node_a);
			const dependents = filer.get_dependents(node_a);

			// Self should not appear in results even if added as dependency
			expect(dependencies.has(node_a)).toBe(false);
			expect(dependents.has(node_a)).toBe(false);
		});

		test('handles empty dependency graphs', async () => {
			const filer = await ctx.create_mounted_filer();

			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);

			expect(filer.get_dependencies(node_a).size).toBe(0);
			expect(filer.get_dependents(node_a).size).toBe(0);
			expect(filer.filter_dependents(node_a).size).toBe(0);
		});

		test('maintains consistency after bulk operations', async () => {
			const filer = await ctx.create_mounted_filer();

			const nodes = [
				filer.get_disknode(TEST_PATHS.FILE_A),
				filer.get_disknode(TEST_PATHS.FILE_B),
				filer.get_disknode(TEST_PATHS.FILE_C),
				filer.get_disknode(TEST_PATHS.FILE_D),
				filer.get_disknode(TEST_PATHS.FILE_E),
			];

			// Create complex dependency graph
			nodes[1].add_dependency(nodes[0]);
			nodes[2].add_dependency(nodes[1]);
			nodes[3].add_dependency(nodes[2]);
			nodes[4].add_dependency(nodes[3]);

			// Verify consistency
			for (const node of nodes) {
				for (const dep_id of node.dependencies.keys()) {
					const dep_node = filer.get_disknode(dep_id);
					expect(dep_node.dependents.has(node.id)).toBe(true);
				}
			}
		});
	});
});
