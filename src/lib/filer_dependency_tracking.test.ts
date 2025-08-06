import {describe, test, expect, vi, beforeEach} from 'vitest';
import {existsSync} from 'node:fs';
import {watch, type FSWatcher} from 'chokidar';

import {Filer} from './filer.ts';
import {Disknode} from './disknode.ts';
import type {Path_Id} from './path.ts';

// Mock modules
vi.mock('node:fs', () => ({
	existsSync: vi.fn(),
	readFileSync: vi.fn(),
	lstatSync: vi.fn(),
	realpathSync: vi.fn(),
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
const TEST_FILE_D: Path_Id = `${TEST_SOURCE}/d.ts`;
const TEST_FILE_E: Path_Id = `${TEST_SOURCE}/e.ts`;
const TEST_EXTERNAL_FILE: Path_Id = '/external/file.ts';
const TEST_JSON_FILE: Path_Id = `${TEST_SOURCE}/data.json`;

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

describe('Filer Dependency Tracking', () => {
	let filer: Filer;

	beforeEach(() => {
		vi.clearAllMocks();
		const mock_watcher = new Mock_Watcher();
		vi.mocked(watch).mockReturnValue(mock_watcher as unknown as FSWatcher);
		vi.mocked(existsSync).mockReturnValue(true);

		filer = new Filer({paths: []});
	});

	describe('direct dependencies', () => {
		test('tracks immediate dependencies only', () => {
			// Set up dependency chain: A -> B -> C
			const node_a = filer.get_node(TEST_FILE_A);
			const node_b = filer.get_node(TEST_FILE_B);
			const node_c = filer.get_node(TEST_FILE_C);

			node_c.add_dependency(node_b);
			node_b.add_dependency(node_a);

			const dependencies = filer.get_dependencies(node_c, false);

			expect(dependencies.size).toBe(1);
			expect(dependencies.has(node_b)).toBe(true);
			expect(dependencies.has(node_a)).toBe(false); // Not direct
			expect(dependencies.has(node_c)).toBe(false); // Self excluded
		});

		test('handles multiple direct dependencies', () => {
			const node_a = filer.get_node(TEST_FILE_A);
			const node_b = filer.get_node(TEST_FILE_B);
			const node_c = filer.get_node(TEST_FILE_C);
			const node_d = filer.get_node(TEST_FILE_D);

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
			const node_a = filer.get_node(TEST_FILE_A);

			const dependencies = filer.get_dependencies(node_a, false);

			expect(dependencies.size).toBe(0);
		});
	});

	describe('transitive dependencies', () => {
		test('tracks full dependency chain', () => {
			// Set up dependency chain: A -> B -> C -> D
			const node_a = filer.get_node(TEST_FILE_A);
			const node_b = filer.get_node(TEST_FILE_B);
			const node_c = filer.get_node(TEST_FILE_C);
			const node_d = filer.get_node(TEST_FILE_D);

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
			// Set up diamond: A -> B, A -> C, B -> D, C -> D
			const node_a = filer.get_node(TEST_FILE_A);
			const node_b = filer.get_node(TEST_FILE_B);
			const node_c = filer.get_node(TEST_FILE_C);
			const node_d = filer.get_node(TEST_FILE_D);

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
			// Set up circular: A -> B -> C -> A
			const node_a = filer.get_node(TEST_FILE_A);
			const node_b = filer.get_node(TEST_FILE_B);
			const node_c = filer.get_node(TEST_FILE_C);

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
			// Set up dependency chain: A <- B <- C
			const node_a = filer.get_node(TEST_FILE_A);
			const node_b = filer.get_node(TEST_FILE_B);
			const node_c = filer.get_node(TEST_FILE_C);

			node_b.add_dependency(node_a);
			node_c.add_dependency(node_b);

			const dependents = filer.get_dependents(node_a, false);

			expect(dependents.size).toBe(1);
			expect(dependents.has(node_b)).toBe(true);
			expect(dependents.has(node_c)).toBe(false); // Not direct
			expect(dependents.has(node_a)).toBe(false); // Self excluded
		});

		test('handles multiple direct dependents', () => {
			const node_a = filer.get_node(TEST_FILE_A);
			const node_b = filer.get_node(TEST_FILE_B);
			const node_c = filer.get_node(TEST_FILE_C);
			const node_d = filer.get_node(TEST_FILE_D);

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
			const node_a = filer.get_node(TEST_FILE_A);

			const dependents = filer.get_dependents(node_a, false);

			expect(dependents.size).toBe(0);
		});
	});

	describe('transitive dependents', () => {
		test('tracks full dependent chain', () => {
			// Set up dependency chain: A <- B <- C <- D
			const node_a = filer.get_node(TEST_FILE_A);
			const node_b = filer.get_node(TEST_FILE_B);
			const node_c = filer.get_node(TEST_FILE_C);
			const node_d = filer.get_node(TEST_FILE_D);

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
			// Set up inverted diamond: A <- B, A <- C, B <- D, C <- D
			const node_a = filer.get_node(TEST_FILE_A);
			const node_b = filer.get_node(TEST_FILE_B);
			const node_c = filer.get_node(TEST_FILE_C);
			const node_d = filer.get_node(TEST_FILE_D);

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
			// Set up circular: A <- B <- C <- A
			const node_a = filer.get_node(TEST_FILE_A);
			const node_b = filer.get_node(TEST_FILE_B);
			const node_c = filer.get_node(TEST_FILE_C);

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
			const node_a = filer.get_node(TEST_FILE_A);
			const node_b = filer.get_node(TEST_FILE_B);
			const node_c = filer.get_node(TEST_FILE_C);
			const node_json = filer.get_node(TEST_JSON_FILE);

			// Set up dependencies
			node_b.add_dependency(node_a);
			node_c.add_dependency(node_a);
			node_json.add_dependency(node_a);

			const ts_dependents = filer.filter_dependents(node_a, (id) => id.endsWith('.ts'), false);

			expect(ts_dependents.size).toBe(2);
			expect(ts_dependents.has(TEST_FILE_B)).toBe(true);
			expect(ts_dependents.has(TEST_FILE_C)).toBe(true);
			expect(ts_dependents.has(TEST_JSON_FILE)).toBe(false);
		});

		test('works with transitive dependents', () => {
			// Chain: A <- B.ts <- C.js <- D.ts
			const node_a = filer.get_node(TEST_FILE_A);
			const node_b = filer.get_node(TEST_FILE_B);
			const node_c = filer.get_node(`${TEST_SOURCE}/c.js`);
			const node_d = filer.get_node(TEST_FILE_D);

			node_b.add_dependency(node_a);
			node_c.add_dependency(node_b);
			node_d.add_dependency(node_c);

			const ts_dependents = filer.filter_dependents(node_a, (id) => id.endsWith('.ts'), true);

			expect(ts_dependents.size).toBe(2);
			expect(ts_dependents.has(TEST_FILE_B)).toBe(true);
			expect(ts_dependents.has(TEST_FILE_D)).toBe(true);
			expect(ts_dependents.has(`${TEST_SOURCE}/c.js`)).toBe(false);
		});

		test('returns empty set when no matches', () => {
			const node_a = filer.get_node(TEST_FILE_A);
			const node_json = filer.get_node(TEST_JSON_FILE);

			node_json.add_dependency(node_a);

			const ts_dependents = filer.filter_dependents(node_a, (id) => id.endsWith('.ts'), false);

			expect(ts_dependents.size).toBe(0);
		});

		test('returns all dependents when no filter provided', () => {
			const node_a = filer.get_node(TEST_FILE_A);
			const node_b = filer.get_node(TEST_FILE_B);
			const node_c = filer.get_node(TEST_FILE_C);

			node_b.add_dependency(node_a);
			node_c.add_dependency(node_a);

			const all_dependents = filer.filter_dependents(node_a, undefined, false);

			expect(all_dependents.size).toBe(2);
			expect(all_dependents.has(TEST_FILE_B)).toBe(true);
			expect(all_dependents.has(TEST_FILE_C)).toBe(true);
		});

		test('handles complex predicate logic', () => {
			const node_a = filer.get_node(TEST_FILE_A);
			const node_b = filer.get_node(`${TEST_SOURCE}/lib/b.ts`);
			const node_c = filer.get_node(`${TEST_SOURCE}/utils/c.ts`);
			const node_d = filer.get_node(`${TEST_SOURCE}/lib/d.js`);

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
			expect(lib_ts_dependents.has(`${TEST_SOURCE}/lib/b.ts`)).toBe(true);
		});
	});

	describe('dependency relationship management', () => {
		test('add_dependency creates bidirectional links', () => {
			const node_a = filer.get_node(TEST_FILE_A);
			const node_b = filer.get_node(TEST_FILE_B);

			node_b.add_dependency(node_a);

			expect(node_b.dependencies.has(TEST_FILE_A)).toBe(true);
			expect(node_b.dependencies.get(TEST_FILE_A)).toBe(node_a);
			expect(node_a.dependents.has(TEST_FILE_B)).toBe(true);
			expect(node_a.dependents.get(TEST_FILE_B)).toBe(node_b);
		});

		test('remove_dependency cleans up bidirectional links', () => {
			const node_a = filer.get_node(TEST_FILE_A);
			const node_b = filer.get_node(TEST_FILE_B);

			// Add then remove
			node_b.add_dependency(node_a);
			expect(node_b.dependencies.has(TEST_FILE_A)).toBe(true);
			expect(node_a.dependents.has(TEST_FILE_B)).toBe(true);

			node_b.remove_dependency(node_a);
			expect(node_b.dependencies.has(TEST_FILE_A)).toBe(false);
			expect(node_a.dependents.has(TEST_FILE_B)).toBe(false);
		});

		test('adding duplicate dependency is idempotent', () => {
			const node_a = filer.get_node(TEST_FILE_A);
			const node_b = filer.get_node(TEST_FILE_B);

			node_b.add_dependency(node_a);
			node_b.add_dependency(node_a); // Duplicate

			expect(node_b.dependencies.size).toBe(1);
			expect(node_a.dependents.size).toBe(1);
		});

		test('removing non-existent dependency is safe', () => {
			const node_a = filer.get_node(TEST_FILE_A);
			const node_b = filer.get_node(TEST_FILE_B);

			// Remove without adding first
			expect(() => node_b.remove_dependency(node_a)).not.toThrow();
			expect(node_b.dependencies.size).toBe(0);
			expect(node_a.dependents.size).toBe(0);
		});
	});

	describe('complex dependency scenarios', () => {
		test('handles large dependency graphs efficiently', () => {
			// Create star pattern: A <- B1, B2, ..., B100
			const node_a = filer.get_node(TEST_FILE_A);
			const dependent_nodes: Array<Disknode> = [];

			for (let i = 1; i <= 100; i++) {
				const dependent = filer.get_node(`/test/file${i}.ts`);
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
			// Create chain: A <- B <- C <- ... <- Z
			const chain_length = 26;
			const nodes: Array<Disknode> = [];

			for (let i = 0; i < chain_length; i++) {
				const char = String.fromCharCode(65 + i); // A, B, C, ..., Z
				nodes.push(filer.get_node(`/test/${char}.ts`));
			}

			// Create dependency chain
			for (let i = 1; i < chain_length; i++) {
				nodes[i].add_dependency(nodes[i - 1]);
			}

			const dependents = filer.get_dependents(nodes[0], true);

			expect(dependents.size).toBe(chain_length - 1);
			for (let i = 1; i < chain_length; i++) {
				expect(dependents.has(nodes[i])).toBe(true);
			}
		});

		test('handles mixed internal and external dependencies', () => {
			const internal_a = filer.get_node(TEST_FILE_A);
			const internal_b = filer.get_node(TEST_FILE_B);
			const external_c = filer.get_node(TEST_EXTERNAL_FILE);

			// Set up mixed dependencies
			internal_b.add_dependency(internal_a);
			internal_b.add_dependency(external_c);

			const dependencies = filer.get_dependencies(internal_b, false);

			expect(dependencies.size).toBe(2);
			expect(dependencies.has(internal_a)).toBe(true);
			expect(dependencies.has(external_c)).toBe(true);
		});

		test('dependency updates are reflected immediately', () => {
			const node_a = filer.get_node(TEST_FILE_A);
			const node_b = filer.get_node(TEST_FILE_B);
			const node_c = filer.get_node(TEST_FILE_C);

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
			const node_a = filer.get_node(TEST_FILE_A);

			// Try to add self-dependency
			node_a.add_dependency(node_a);

			// Should not appear in dependency/dependent lists due to exclusion logic
			const dependencies = filer.get_dependencies(node_a, true);
			const dependents = filer.get_dependents(node_a, true);

			expect(dependencies.has(node_a)).toBe(false);
			expect(dependents.has(node_a)).toBe(false);
		});

		test('handles empty dependency graphs', () => {
			const node_a = filer.get_node(TEST_FILE_A);

			expect(filer.get_dependencies(node_a, true)).toEqual(new Set());
			expect(filer.get_dependents(node_a, true)).toEqual(new Set());
			expect(filer.filter_dependents(node_a, () => true, true)).toEqual(new Set());
		});

		test('maintains consistency after bulk operations', () => {
			const nodes = [
				filer.get_node(TEST_FILE_A),
				filer.get_node(TEST_FILE_B),
				filer.get_node(TEST_FILE_C),
				filer.get_node(TEST_FILE_D),
				filer.get_node(TEST_FILE_E),
			];

			// Create complex relationships
			nodes[1].add_dependency(nodes[0]); // B -> A
			nodes[2].add_dependency(nodes[1]); // C -> B
			nodes[3].add_dependency(nodes[2]); // D -> C
			nodes[4].add_dependency(nodes[0]); // E -> A
			nodes[4].add_dependency(nodes[3]); // E -> D

			// Verify consistency
			expect(nodes[0].dependents.size).toBe(2); // A has dependents B and E
			expect(nodes[1].dependencies.size).toBe(1); // B depends on A
			expect(nodes[1].dependents.size).toBe(1); // B has dependent C
			expect(nodes[4].dependencies.size).toBe(2); // E depends on A and D

			// Remove some relationships
			nodes[4].remove_dependency(nodes[0]); // E no longer depends on A
			nodes[2].remove_dependency(nodes[1]); // C no longer depends on B

			// Verify updated consistency
			expect(nodes[0].dependents.size).toBe(1); // A now only has dependent B
			expect(nodes[1].dependents.size).toBe(0); // B has no dependents
		});
	});
});
