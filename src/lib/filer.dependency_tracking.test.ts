// @slop Claude Opus 4.1

import {describe, test, expect, vi} from 'vitest';

import {Disknode} from './disknode.ts';
import {use_filer_test_context, TEST_PATHS} from './filer.test_helpers.ts';

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

describe('Filer Dependency Tracking', () => {
	const ctx = use_filer_test_context();

	describe('direct dependencies', () => {
		test('tracks immediate dependencies only', () => {
			const filer = ctx.create_filer({paths: []});

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

		test('handles multiple direct dependencies', () => {
			const filer = ctx.create_filer({paths: []});

			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
			const node_c = filer.get_disknode(TEST_PATHS.FILE_C);
			const node_d = filer.get_disknode(TEST_PATHS.FILE_D);

			// D depends on A, B, and C
			node_d.add_dependency(node_a);
			node_d.add_dependency(node_b);
			node_d.add_dependency(node_c);

			const dependencies = filer.get_dependencies(node_d, false);

			expect(dependencies.size).toBe(3);
			expect(dependencies.has(node_a)).toBe(true);
			expect(dependencies.has(node_b)).toBe(true);
			expect(dependencies.has(node_c)).toBe(true);
			expect(dependencies.has(node_d)).toBe(false);
		});

		test('returns empty set when no dependencies', () => {
			const filer = ctx.create_filer({paths: []});

			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);

			const dependencies = filer.get_dependencies(node_a, false);

			expect(dependencies.size).toBe(0);
		});
	});

	describe('transitive dependencies', () => {
		test('tracks full dependency chain', () => {
			const filer = ctx.create_filer({paths: []});

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

		test('handles diamond dependency pattern', () => {
			const filer = ctx.create_filer({paths: []});

			// Set up diamond: A -> B, A -> C, B -> D, C -> D
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
			expect(dependencies.has(node_a)).toBe(true); // Should appear only once
			expect(dependencies.has(node_b)).toBe(true);
			expect(dependencies.has(node_c)).toBe(true);
		});

		test('handles circular dependencies without infinite loop', () => {
			const filer = ctx.create_filer({paths: []});

			// Set up circular: A -> B -> C -> A
			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
			const node_c = filer.get_disknode(TEST_PATHS.FILE_C);

			node_a.add_dependency(node_c);
			node_c.add_dependency(node_b);
			node_b.add_dependency(node_a);

			const dependencies = filer.get_dependencies(node_a, true);

			// Should complete without infinite loop
			expect(dependencies.size).toBe(2);
			expect(dependencies.has(node_b)).toBe(true);
			expect(dependencies.has(node_c)).toBe(true);
			expect(dependencies.has(node_a)).toBe(false); // Self excluded
		});
	});

	describe('direct dependents', () => {
		test('tracks immediate dependents only', () => {
			const filer = ctx.create_filer({paths: []});

			// Set up dependency chain: A <- B <- C
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

		test('handles multiple direct dependents', () => {
			const filer = ctx.create_filer({paths: []});

			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
			const node_c = filer.get_disknode(TEST_PATHS.FILE_C);
			const node_d = filer.get_disknode(TEST_PATHS.FILE_D);

			// B, C, and D all depend on A
			node_b.add_dependency(node_a);
			node_c.add_dependency(node_a);
			node_d.add_dependency(node_a);

			const dependents = filer.get_dependents(node_a, false);

			expect(dependents.size).toBe(3);
			expect(dependents.has(node_b)).toBe(true);
			expect(dependents.has(node_c)).toBe(true);
			expect(dependents.has(node_d)).toBe(true);
			expect(dependents.has(node_a)).toBe(false);
		});

		test('returns empty set when no dependents', () => {
			const filer = ctx.create_filer({paths: []});

			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);

			const dependents = filer.get_dependents(node_a, false);

			expect(dependents.size).toBe(0);
		});
	});

	describe('transitive dependents', () => {
		test('tracks full dependent chain', () => {
			const filer = ctx.create_filer({paths: []});

			// Set up dependency chain: A <- B <- C <- D
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

		test('handles inverted diamond dependency pattern', () => {
			const filer = ctx.create_filer({paths: []});

			// Set up inverted diamond: A <- B, A <- C, B <- D, C <- D
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
			expect(dependents.has(node_d)).toBe(true); // Should appear only once
		});

		test('handles circular dependents without infinite loop', () => {
			const filer = ctx.create_filer({paths: []});

			// Set up circular: A <- B <- C <- A
			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
			const node_c = filer.get_disknode(TEST_PATHS.FILE_C);

			node_c.add_dependency(node_a);
			node_b.add_dependency(node_c);
			node_a.add_dependency(node_b);

			const dependents = filer.get_dependents(node_a, true);

			// Should complete without infinite loop
			expect(dependents.size).toBe(2);
			expect(dependents.has(node_b)).toBe(true);
			expect(dependents.has(node_c)).toBe(true);
			expect(dependents.has(node_a)).toBe(false); // Self excluded
		});
	});

	describe('filtered dependents', () => {
		test('filters by predicate function', () => {
			const filer = ctx.create_filer({paths: []});

			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
			const node_c = filer.get_disknode(TEST_PATHS.FILE_C);
			const node_json = filer.get_disknode(TEST_PATHS.JSON_FILE);

			// Set up dependencies
			node_b.add_dependency(node_a);
			node_c.add_dependency(node_a);
			node_json.add_dependency(node_a);

			const ts_dependents = filer.filter_dependents(node_a, (id) => id.endsWith('.ts'), false);

			expect(ts_dependents.size).toBe(2);
			expect(ts_dependents.has(TEST_PATHS.FILE_B)).toBe(true);
			expect(ts_dependents.has(TEST_PATHS.FILE_C)).toBe(true);
			expect(ts_dependents.has(TEST_PATHS.JSON_FILE)).toBe(false);
		});

		test('works with transitive dependents', () => {
			const filer = ctx.create_filer({paths: []});

			// Chain: A <- B.ts <- C.js <- D.ts
			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
			const node_c = filer.get_disknode(`${TEST_PATHS.SOURCE}/c.js`);
			const node_d = filer.get_disknode(TEST_PATHS.FILE_D);

			node_b.add_dependency(node_a);
			node_c.add_dependency(node_b);
			node_d.add_dependency(node_c);

			const ts_dependents = filer.filter_dependents(node_a, (id) => id.endsWith('.ts'), true);

			expect(ts_dependents.size).toBe(2);
			expect(ts_dependents.has(TEST_PATHS.FILE_B)).toBe(true);
			expect(ts_dependents.has(TEST_PATHS.FILE_D)).toBe(true);
			expect(ts_dependents.has(`${TEST_PATHS.SOURCE}/c.js`)).toBe(false);
		});

		test('returns empty set when no matches', () => {
			const filer = ctx.create_filer({paths: []});

			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_json = filer.get_disknode(TEST_PATHS.JSON_FILE);

			node_json.add_dependency(node_a);

			const ts_dependents = filer.filter_dependents(node_a, (id) => id.endsWith('.ts'), false);

			expect(ts_dependents.size).toBe(0);
		});

		test('returns all dependents when no filter provided', () => {
			const filer = ctx.create_filer({paths: []});

			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
			const node_c = filer.get_disknode(TEST_PATHS.FILE_C);

			node_b.add_dependency(node_a);
			node_c.add_dependency(node_a);

			const all_dependents = filer.filter_dependents(node_a, undefined, false);

			expect(all_dependents.size).toBe(2);
			expect(all_dependents.has(TEST_PATHS.FILE_B)).toBe(true);
			expect(all_dependents.has(TEST_PATHS.FILE_C)).toBe(true);
		});

		test('handles complex predicate logic', () => {
			const filer = ctx.create_filer({paths: []});

			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(`${TEST_PATHS.SOURCE}/lib/b.ts`);
			const node_c = filer.get_disknode(`${TEST_PATHS.SOURCE}/utils/c.ts`);
			const node_d = filer.get_disknode(`${TEST_PATHS.SOURCE}/lib/d.js`);

			node_b.add_dependency(node_a);
			node_c.add_dependency(node_a);
			node_d.add_dependency(node_a);

			// Filter for TypeScript files in lib directory
			const lib_ts_dependents = filer.filter_dependents(
				node_a,
				(id) => id.includes('/lib/') && id.endsWith('.ts'),
				false,
			);

			expect(lib_ts_dependents.size).toBe(1);
			expect(lib_ts_dependents.has(`${TEST_PATHS.SOURCE}/lib/b.ts`)).toBe(true);
		});
	});

	describe('dependency relationship management', () => {
		test('add_dependency creates bidirectional links', () => {
			const filer = ctx.create_filer({paths: []});

			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);

			node_b.add_dependency(node_a);

			expect(node_b.dependencies.has(TEST_PATHS.FILE_A)).toBe(true);
			expect(node_b.dependencies.get(TEST_PATHS.FILE_A)).toBe(node_a);
			expect(node_a.dependents.has(TEST_PATHS.FILE_B)).toBe(true);
			expect(node_a.dependents.get(TEST_PATHS.FILE_B)).toBe(node_b);
		});

		test('remove_dependency cleans up bidirectional links', () => {
			const filer = ctx.create_filer({paths: []});

			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);

			// Add then remove
			node_b.add_dependency(node_a);
			expect(node_b.dependencies.has(TEST_PATHS.FILE_A)).toBe(true);
			expect(node_a.dependents.has(TEST_PATHS.FILE_B)).toBe(true);

			node_b.remove_dependency(node_a);
			expect(node_b.dependencies.has(TEST_PATHS.FILE_A)).toBe(false);
			expect(node_a.dependents.has(TEST_PATHS.FILE_B)).toBe(false);
		});

		test('adding duplicate dependency is idempotent', () => {
			const filer = ctx.create_filer({paths: []});

			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);

			node_b.add_dependency(node_a);
			node_b.add_dependency(node_a); // Duplicate

			expect(node_b.dependencies.size).toBe(1);
			expect(node_a.dependents.size).toBe(1);
		});

		test('removing non-existent dependency is safe', () => {
			const filer = ctx.create_filer({paths: []});

			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);

			// Remove without adding first
			expect(() => node_b.remove_dependency(node_a)).not.toThrow();
			expect(node_b.dependencies.size).toBe(0);
			expect(node_a.dependents.size).toBe(0);
		});
	});

	describe('complex dependency scenarios', () => {
		test('handles large dependency graphs efficiently', () => {
			const filer = ctx.create_filer({paths: []});

			// Create star pattern: A <- B1, B2, ..., B100
			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const dependent_nodes: Array<Disknode> = [];

			for (let i = 1; i <= 100; i++) {
				const dependent = filer.get_disknode(`/test/file${i}.ts`);
				dependent.add_dependency(node_a);
				dependent_nodes.push(dependent);
			}

			const dependents = filer.get_dependents(node_a, false);

			expect(dependents.size).toBe(100);
			for (const dependent of dependent_nodes) {
				expect(dependents.has(dependent)).toBe(true);
			}
		});

		test('handles deep dependency chains', () => {
			const filer = ctx.create_filer({paths: []});

			// Create chain: A <- B <- C <- ... <- Z
			const chain_length = 26;
			const disknodes: Array<Disknode> = [];

			for (let i = 0; i < chain_length; i++) {
				const char = String.fromCharCode(65 + i); // A, B, C, ..., Z
				disknodes.push(filer.get_disknode(`/test/${char}.ts`));
			}

			// Create dependency chain
			for (let i = 1; i < chain_length; i++) {
				disknodes[i].add_dependency(disknodes[i - 1]);
			}

			const dependents = filer.get_dependents(disknodes[0], true);

			expect(dependents.size).toBe(chain_length - 1);
			for (let i = 1; i < chain_length; i++) {
				expect(dependents.has(disknodes[i])).toBe(true);
			}
		});

		test('handles mixed internal and external dependencies', () => {
			const filer = ctx.create_filer({paths: []});

			const internal_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const internal_b = filer.get_disknode(TEST_PATHS.FILE_B);
			const external_c = filer.get_disknode(TEST_PATHS.EXTERNAL_FILE);

			// Set up mixed dependencies
			internal_b.add_dependency(internal_a);
			internal_b.add_dependency(external_c);

			const dependencies = filer.get_dependencies(internal_b, false);

			expect(dependencies.size).toBe(2);
			expect(dependencies.has(internal_a)).toBe(true);
			expect(dependencies.has(external_c)).toBe(true);
		});

		test('dependency updates are reflected immediately', () => {
			const filer = ctx.create_filer({paths: []});

			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
			const node_c = filer.get_disknode(TEST_PATHS.FILE_C);

			// Initial state: B depends on A
			node_b.add_dependency(node_a);
			expect(filer.get_dependencies(node_b, false).size).toBe(1);
			expect(filer.get_dependents(node_a, false).size).toBe(1);

			// Add another dependency: B also depends on C
			node_b.add_dependency(node_c);
			expect(filer.get_dependencies(node_b, false).size).toBe(2);
			expect(filer.get_dependents(node_c, false).size).toBe(1);

			// Remove first dependency: B no longer depends on A
			node_b.remove_dependency(node_a);
			expect(filer.get_dependencies(node_b, false).size).toBe(1);
			expect(filer.get_dependents(node_a, false).size).toBe(0);
		});
	});

	describe('edge cases', () => {
		test('handles self-dependencies gracefully', () => {
			const filer = ctx.create_filer({paths: []});

			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);

			// Try to add self-dependency
			node_a.add_dependency(node_a);

			// Should not appear in dependency/dependent lists due to exclusion logic
			const dependencies = filer.get_dependencies(node_a, true);
			const dependents = filer.get_dependents(node_a, true);

			expect(dependencies.has(node_a)).toBe(false);
			expect(dependents.has(node_a)).toBe(false);
		});

		test('handles empty dependency graphs', () => {
			const filer = ctx.create_filer({paths: []});

			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);

			expect(filer.get_dependencies(node_a, true)).toEqual(new Set());
			expect(filer.get_dependents(node_a, true)).toEqual(new Set());
			expect(filer.filter_dependents(node_a, () => true, true)).toEqual(new Set());
		});

		test('maintains consistency after bulk operations', () => {
			const filer = ctx.create_filer({paths: []});

			const disknodes = [
				filer.get_disknode(TEST_PATHS.FILE_A),
				filer.get_disknode(TEST_PATHS.FILE_B),
				filer.get_disknode(TEST_PATHS.FILE_C),
				filer.get_disknode(TEST_PATHS.FILE_D),
				filer.get_disknode(TEST_PATHS.FILE_E),
			];

			// Create complex relationships
			disknodes[1].add_dependency(disknodes[0]); // B -> A
			disknodes[2].add_dependency(disknodes[1]); // C -> B
			disknodes[3].add_dependency(disknodes[2]); // D -> C
			disknodes[4].add_dependency(disknodes[0]); // E -> A
			disknodes[4].add_dependency(disknodes[3]); // E -> D

			// Verify consistency
			expect(disknodes[0].dependents.size).toBe(2); // A has dependents B and E
			expect(disknodes[1].dependencies.size).toBe(1); // B depends on A
			expect(disknodes[1].dependents.size).toBe(1); // B has dependent C
			expect(disknodes[4].dependencies.size).toBe(2); // E depends on A and D

			// Remove some relationships
			disknodes[4].remove_dependency(disknodes[0]); // E no longer depends on A
			disknodes[2].remove_dependency(disknodes[1]); // C no longer depends on B

			// Verify updated consistency
			expect(disknodes[0].dependents.size).toBe(1); // A now only has dependent B
			expect(disknodes[1].dependents.size).toBe(0); // B has no dependents
		});
	});
});
