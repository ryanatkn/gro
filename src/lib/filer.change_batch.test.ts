// @slop Claude Opus 4.1

import {describe, test, expect, vi} from 'vitest';

import {Filer_Change_Batch, type Filer_Change} from './filer_helpers.ts';
import {Disknode} from './disknode.ts';
import {use_filer_test_context, create_mock_stats, TEST_PATHS} from './filer.test_helpers.ts';

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

describe('Filer_Change_Batch', () => {
	const ctx = use_filer_test_context();

	// Helper to create mock filer for Disknode tests
	const create_mock_filer = () =>
		({
			disknodes: new Map(),
			get_disknode: (id: string) => new Disknode(id, create_mock_filer()),
		}) as any;

	describe('construction', () => {
		test('creates empty batch by default', () => {
			const batch = new Filer_Change_Batch();
			expect(batch.size).toBe(0);
			expect(batch.is_empty).toBe(true);
			expect(Array.from(batch.changes.keys())).toEqual([]);
		});

		test('accepts initial changes from iterator', () => {
			const changes: Array<Filer_Change> = [
				{type: 'add', disknode: undefined, id: TEST_PATHS.FILE_A, kind: 'file'},
				{type: 'update', disknode: undefined, id: TEST_PATHS.FILE_B, kind: 'file'},
			];

			const batch = new Filer_Change_Batch(changes);
			expect(batch.size).toBe(2);
			expect(batch.has(TEST_PATHS.FILE_A)).toBe(true);
			expect(batch.has(TEST_PATHS.FILE_B)).toBe(true);
		});

		test('uses last change for duplicate paths', () => {
			const changes: Array<Filer_Change> = [
				{type: 'add', disknode: undefined, id: TEST_PATHS.FILE_A, kind: 'file'},
				{type: 'update', disknode: undefined, id: TEST_PATHS.FILE_A, kind: 'file'},
			];

			const batch = new Filer_Change_Batch(changes);
			expect(batch.size).toBe(1);
			expect(batch.get(TEST_PATHS.FILE_A)?.type).toBe('update');
		});

		test('creates from Map.values() iterator', () => {
			const changes_map = new Map();
			changes_map.set(TEST_PATHS.FILE_A, {
				type: 'add',
				disknode: undefined,
				id: TEST_PATHS.FILE_A,
				kind: 'file',
			});
			changes_map.set(TEST_PATHS.FILE_B, {
				type: 'delete',
				disknode: undefined,
				id: TEST_PATHS.FILE_B,
				kind: 'file',
			});

			const batch = new Filer_Change_Batch(changes_map.values());
			expect(batch.size).toBe(2);
			expect(batch.get(TEST_PATHS.FILE_A)?.type).toBe('add');
			expect(batch.get(TEST_PATHS.FILE_B)?.type).toBe('delete');
		});
	});

	describe('change retrieval', () => {
		test('has() checks for path existence', () => {
			const batch = new Filer_Change_Batch([
				{type: 'add', disknode: undefined, id: TEST_PATHS.FILE_A, kind: 'file'},
			]);

			expect(batch.has(TEST_PATHS.FILE_A)).toBe(true);
			expect(batch.has(TEST_PATHS.FILE_B)).toBe(false);
		});

		test('get() returns specific change', () => {
			const change: Filer_Change = {
				type: 'add',
				disknode: undefined,
				id: TEST_PATHS.FILE_A,
				kind: 'file',
			};
			const batch = new Filer_Change_Batch([change]);

			expect(batch.get(TEST_PATHS.FILE_A)).toBe(change);
			expect(batch.get(TEST_PATHS.FILE_B)).toBeUndefined();
		});

		test('size returns number of changes', () => {
			const batch = new Filer_Change_Batch();
			expect(batch.size).toBe(0);

			batch.changes.set(TEST_PATHS.FILE_A, {
				type: 'add',
				disknode: undefined,
				id: TEST_PATHS.FILE_A,
				kind: 'file',
			});
			expect(batch.size).toBe(1);

			batch.changes.set(TEST_PATHS.FILE_B, {
				type: 'update',
				disknode: undefined,
				id: TEST_PATHS.FILE_B,
				kind: 'file',
			});
			expect(batch.size).toBe(2);
		});

		test('is_empty checks for empty batch', () => {
			const empty_batch = new Filer_Change_Batch();
			expect(empty_batch.is_empty).toBe(true);

			const batch = new Filer_Change_Batch([
				{type: 'add', disknode: undefined, id: TEST_PATHS.FILE_A, kind: 'file'},
			]);
			expect(batch.is_empty).toBe(false);
		});
	});

	describe('categorized getters', () => {
		test('added returns only add changes with disknodes', () => {
			const filer = create_mock_filer();
			const node_a = new Disknode(TEST_PATHS.FILE_A, filer);
			const node_b = new Disknode(TEST_PATHS.FILE_B, filer);

			const changes: Array<Filer_Change> = [
				{type: 'add', disknode: node_a, id: TEST_PATHS.FILE_A, kind: 'file'},
				{type: 'add', disknode: undefined, id: TEST_PATHS.FILE_B, kind: 'file'}, // No node
				{type: 'update', disknode: node_b, id: TEST_PATHS.FILE_C, kind: 'file'},
			];

			const batch = new Filer_Change_Batch(changes);
			const added = batch.added;

			expect(added).toHaveLength(1);
			expect(added[0]).toBe(node_a);
		});

		test('updated returns only update changes with disknodes', () => {
			const filer = create_mock_filer();
			const node_a = new Disknode(TEST_PATHS.FILE_A, filer);
			const node_b = new Disknode(TEST_PATHS.FILE_B, filer);

			const changes: Array<Filer_Change> = [
				{type: 'add', disknode: node_a, id: TEST_PATHS.FILE_A, kind: 'file'},
				{type: 'update', disknode: node_b, id: TEST_PATHS.FILE_B, kind: 'file'},
				{type: 'update', disknode: undefined, id: TEST_PATHS.FILE_C, kind: 'file'}, // No node
			];

			const batch = new Filer_Change_Batch(changes);
			const updated = batch.updated;

			expect(updated).toHaveLength(1);
			expect(updated[0]).toBe(node_b);
		});

		test('deleted returns only delete change IDs', () => {
			const filer = create_mock_filer();
			const node_a = new Disknode(TEST_PATHS.FILE_A, filer);

			const changes: Array<Filer_Change> = [
				{type: 'add', disknode: node_a, id: TEST_PATHS.FILE_A, kind: 'file'},
				{type: 'delete', disknode: undefined, id: TEST_PATHS.FILE_B, kind: 'file'},
				{type: 'delete', disknode: undefined, id: TEST_PATHS.FILE_C, kind: 'directory'},
			];

			const batch = new Filer_Change_Batch(changes);
			const deleted = batch.deleted;

			expect(deleted).toHaveLength(2);
			expect(deleted).toContain(TEST_PATHS.FILE_B);
			expect(deleted).toContain(TEST_PATHS.FILE_C);
		});

		test('all_disknodes returns all disknodes from add and update changes', () => {
			const filer = create_mock_filer();
			const node_a = new Disknode(TEST_PATHS.FILE_A, filer);
			const node_b = new Disknode(TEST_PATHS.FILE_B, filer);

			const changes: Array<Filer_Change> = [
				{type: 'add', disknode: node_a, id: TEST_PATHS.FILE_A, kind: 'file'},
				{type: 'update', disknode: node_b, id: TEST_PATHS.FILE_B, kind: 'file'},
				{type: 'delete', disknode: undefined, id: TEST_PATHS.FILE_C, kind: 'file'},
				{type: 'add', disknode: undefined, id: TEST_PATHS.DIR_LIB, kind: 'directory'}, // No node
			];

			const batch = new Filer_Change_Batch(changes);
			const all_disknodes = batch.all_disknodes;

			expect(all_disknodes).toHaveLength(2);
			expect(all_disknodes).toContain(node_a);
			expect(all_disknodes).toContain(node_b);
		});

		test('handles mixed file types and change types', () => {
			const filer = create_mock_filer();
			const file_node = new Disknode(TEST_PATHS.FILE_A, filer);
			const dir_node = new Disknode(TEST_PATHS.DIR_LIB, filer);

			const changes: Array<Filer_Change> = [
				{type: 'add', disknode: file_node, id: TEST_PATHS.FILE_A, kind: 'file'},
				{type: 'update', disknode: dir_node, id: TEST_PATHS.DIR_LIB, kind: 'directory'},
				{type: 'delete', disknode: undefined, id: TEST_PATHS.FILE_B, kind: 'file'},
				{type: 'delete', disknode: undefined, id: TEST_PATHS.FILE_C, kind: 'directory'},
			];

			const batch = new Filer_Change_Batch(changes);

			expect(batch.added).toEqual([file_node]);
			expect(batch.updated).toEqual([dir_node]);
			expect(batch.deleted).toHaveLength(2);
			expect(batch.deleted).toContain(TEST_PATHS.FILE_B);
			expect(batch.deleted).toContain(TEST_PATHS.FILE_C);
			expect(batch.all_disknodes).toEqual([file_node, dir_node]);
		});

		test('handles empty results', () => {
			const batch = new Filer_Change_Batch();

			expect(batch.added).toEqual([]);
			expect(batch.updated).toEqual([]);
			expect(batch.deleted).toEqual([]);
			expect(batch.all_disknodes).toEqual([]);
		});

		test('handles batch with only delete changes', () => {
			const changes: Array<Filer_Change> = [
				{type: 'delete', disknode: undefined, id: TEST_PATHS.FILE_A, kind: 'file'},
				{type: 'delete', disknode: undefined, id: TEST_PATHS.FILE_B, kind: 'directory'},
			];

			const batch = new Filer_Change_Batch(changes);

			expect(batch.added).toEqual([]);
			expect(batch.updated).toEqual([]);
			expect(batch.deleted).toEqual([TEST_PATHS.FILE_A, TEST_PATHS.FILE_B]);
			expect(batch.all_disknodes).toEqual([]);
		});

		test('maintains order from map iteration', () => {
			const filer = create_mock_filer();
			const node_a = new Disknode(TEST_PATHS.FILE_A, filer);
			const node_b = new Disknode(TEST_PATHS.FILE_B, filer);
			const node_c = new Disknode(TEST_PATHS.FILE_C, filer);

			const changes: Array<Filer_Change> = [
				{type: 'add', disknode: node_a, id: TEST_PATHS.FILE_A, kind: 'file'},
				{type: 'add', disknode: node_b, id: TEST_PATHS.FILE_B, kind: 'file'},
				{type: 'add', disknode: node_c, id: TEST_PATHS.FILE_C, kind: 'file'},
			];

			const batch = new Filer_Change_Batch(changes);
			const added = batch.added;

			// Should maintain insertion order
			expect(added).toHaveLength(3);
			expect(added[0]).toBe(node_a);
			expect(added[1]).toBe(node_b);
			expect(added[2]).toBe(node_c);
		});
	});

	describe('integration with filesystem changes', () => {
		test('processes real filer change batch from file events', async () => {
			const filer = await ctx.create_ready_filer({paths: [TEST_PATHS.SOURCE], batch_delay: 0});

			// Create initial state
			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A, create_mock_stats());
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Change then delete
			ctx.mock_watcher.emit('change', TEST_PATHS.FILE_A, create_mock_stats({size: 200}));
			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_B, create_mock_stats());
			ctx.mock_watcher.emit('unlink', TEST_PATHS.FILE_C);

			await new Promise((resolve) => setTimeout(resolve, 10));

			// Verify nodes were created and processed
			const node_a = filer.get_disknode(TEST_PATHS.FILE_A);
			const node_b = filer.get_disknode(TEST_PATHS.FILE_B);
			expect(node_a.exists).toBe(true);
			expect(node_b.exists).toBe(true);
		});

		test('handles batch with mixed external and internal nodes', async () => {
			const filer = await ctx.create_ready_filer({paths: [TEST_PATHS.SOURCE]});

			// Create internal and external disknodes
			const internal_node = filer.get_disknode(TEST_PATHS.FILE_A);
			const external_node = filer.get_disknode(TEST_PATHS.EXTERNAL_FILE);

			expect(internal_node.is_external).toBe(false);
			expect(external_node.is_external).toBe(true);

			// Create batch with both
			const changes: Array<Filer_Change> = [
				{type: 'update', disknode: internal_node, id: TEST_PATHS.FILE_A, kind: 'file'},
				{type: 'update', disknode: external_node, id: TEST_PATHS.EXTERNAL_FILE, kind: 'file'},
			];

			const batch = new Filer_Change_Batch(changes);

			// Both should be included in all_disknodes
			expect(batch.all_disknodes).toHaveLength(2);
			expect(batch.all_disknodes).toContain(internal_node);
			expect(batch.all_disknodes).toContain(external_node);
		});
	});

	describe('edge cases', () => {
		test('handles changes without disknodes gracefully', () => {
			const changes: Array<Filer_Change> = [
				{type: 'add', disknode: undefined, id: TEST_PATHS.FILE_A, kind: 'file'},
				{type: 'update', disknode: undefined, id: TEST_PATHS.FILE_B, kind: 'file'},
			];

			const batch = new Filer_Change_Batch(changes);

			expect(batch.added).toEqual([]);
			expect(batch.updated).toEqual([]);
			expect(batch.all_disknodes).toEqual([]);
			expect(batch.size).toBe(2);
		});

		test('handles directory vs file changes correctly', () => {
			const filer = create_mock_filer();
			const file_node = new Disknode(TEST_PATHS.FILE_A, filer);
			file_node.kind = 'file';
			const dir_node = new Disknode(TEST_PATHS.DIR_LIB, filer);
			dir_node.kind = 'directory';

			const changes: Array<Filer_Change> = [
				{type: 'add', disknode: file_node, id: TEST_PATHS.FILE_A, kind: 'file'},
				{type: 'add', disknode: dir_node, id: TEST_PATHS.DIR_LIB, kind: 'directory'},
			];

			const batch = new Filer_Change_Batch(changes);

			expect(batch.added).toHaveLength(2);
			expect(batch.added).toContain(file_node);
			expect(batch.added).toContain(dir_node);
		});

		test('handles very large batches efficiently', () => {
			// Create 1000 changes
			const changes: Array<Filer_Change> = [];
			for (let i = 0; i < 1000; i++) {
				changes.push({
					type: i % 3 === 0 ? 'add' : i % 3 === 1 ? 'update' : 'delete',
					disknode: undefined,
					id: `/test/file${i}.ts`,
					kind: 'file',
				});
			}

			const batch = new Filer_Change_Batch(changes);

			expect(batch.size).toBe(1000);
			expect(batch.deleted).toHaveLength(333); // Roughly 1/3
		});

		test('handles duplicate IDs with different change types', () => {
			const filer = create_mock_filer();
			const node = new Disknode(TEST_PATHS.FILE_A, filer);

			const changes: Array<Filer_Change> = [
				{type: 'add', disknode: node, id: TEST_PATHS.FILE_A, kind: 'file'},
				{type: 'update', disknode: node, id: TEST_PATHS.FILE_A, kind: 'file'}, // Overwrites add
				{type: 'delete', disknode: undefined, id: TEST_PATHS.FILE_A, kind: 'file'}, // Overwrites update
			];

			const batch = new Filer_Change_Batch(changes);

			expect(batch.size).toBe(1);
			expect(batch.get(TEST_PATHS.FILE_A)?.type).toBe('delete');
			expect(batch.added).toEqual([]);
			expect(batch.updated).toEqual([]);
			expect(batch.deleted).toEqual([TEST_PATHS.FILE_A]);
		});

		test('empty iterator creates empty batch', () => {
			const batch = new Filer_Change_Batch([]);
			expect(batch.is_empty).toBe(true);
			expect(batch.size).toBe(0);
		});

		test('handles null/undefined disknode references', () => {
			const changes: Array<Filer_Change> = [
				{type: 'add', disknode: null as any, id: TEST_PATHS.FILE_A, kind: 'file'},
				{type: 'update', disknode: undefined, id: TEST_PATHS.FILE_B, kind: 'file'},
			];

			const batch = new Filer_Change_Batch(changes);

			expect(batch.added).toEqual([]);
			expect(batch.updated).toEqual([]);
			expect(batch.all_disknodes).toEqual([]);
		});
	});
});