// @slop Claude Opus 4.1

import {describe, test, expect} from 'vitest';

import {Filer_Change_Batch, type Filer_Change} from './filer.ts';
import {Disknode} from './disknode.ts';
import type {Path_Id} from './path.ts';

// Test constants
const TEST_FILE_A: Path_Id = '/test/a.ts';
const TEST_FILE_B: Path_Id = '/test/b.ts';
const TEST_FILE_C: Path_Id = '/test/c.ts';
const TEST_DIR: Path_Id = '/test/dir';

// Mock filer for Disknode creation
const create_mock_filer = () =>
	({
		disknodes: new Map(),
		get_disknode: (id: Path_Id) => new Disknode(id, create_mock_filer()),
	}) as any;

describe('Filer_Change_Batch', () => {
	describe('construction', () => {
		test('creates empty batch by default', () => {
			const batch = new Filer_Change_Batch();
			expect(batch.size).toBe(0);
			expect(batch.is_empty).toBe(true);
			expect(Array.from(batch.changes.keys())).toEqual([]);
		});

		test('accepts initial changes', () => {
			const changes: Array<Filer_Change> = [
				{type: 'add', disknode: undefined, id: TEST_FILE_A, kind: 'file'},
				{type: 'update', disknode: undefined, id: TEST_FILE_B, kind: 'file'},
			];

			const batch = new Filer_Change_Batch(changes);
			expect(batch.size).toBe(2);
			expect(batch.has(TEST_FILE_A)).toBe(true);
			expect(batch.has(TEST_FILE_B)).toBe(true);
		});

		test('uses last change for duplicate paths', () => {
			const changes: Array<Filer_Change> = [
				{type: 'add', disknode: undefined, id: TEST_FILE_A, kind: 'file'},
				{type: 'update', disknode: undefined, id: TEST_FILE_A, kind: 'file'},
			];

			const batch = new Filer_Change_Batch(changes);
			expect(batch.size).toBe(1);
			expect(batch.get(TEST_FILE_A)?.type).toBe('update');
		});
	});

	describe('change retrieval', () => {
		test('has() checks for path existence', () => {
			const batch = new Filer_Change_Batch([
				{type: 'add', disknode: undefined, id: TEST_FILE_A, kind: 'file'},
			]);

			expect(batch.has(TEST_FILE_A)).toBe(true);
			expect(batch.has(TEST_FILE_B)).toBe(false);
		});

		test('get() returns specific change', () => {
			const change: Filer_Change = {
				type: 'add',
				disknode: undefined,
				id: TEST_FILE_A,
				kind: 'file',
			};
			const batch = new Filer_Change_Batch([change]);

			expect(batch.get(TEST_FILE_A)).toBe(change);
			expect(batch.get(TEST_FILE_B)).toBeUndefined();
		});

		test('size returns number of changes', () => {
			const batch = new Filer_Change_Batch();
			expect(batch.size).toBe(0);

			batch.changes.set(TEST_FILE_A, {
				type: 'add',
				disknode: undefined,
				id: TEST_FILE_A,
				kind: 'file',
			});
			expect(batch.size).toBe(1);

			batch.changes.set(TEST_FILE_B, {
				type: 'update',
				disknode: undefined,
				id: TEST_FILE_B,
				kind: 'file',
			});
			expect(batch.size).toBe(2);
		});

		test('is_empty checks for empty batch', () => {
			const empty_batch = new Filer_Change_Batch();
			expect(empty_batch.is_empty).toBe(true);

			const batch = new Filer_Change_Batch([
				{type: 'add', disknode: undefined, id: TEST_FILE_A, kind: 'file'},
			]);
			expect(batch.is_empty).toBe(false);
		});
	});

	describe('categorized getters', () => {
		test('added returns only add changes with disknodes', () => {
			const filer = create_mock_filer();
			const node_a = new Disknode(TEST_FILE_A, filer);
			const node_b = new Disknode(TEST_FILE_B, filer);

			const changes: Array<Filer_Change> = [
				{type: 'add', disknode: node_a, id: TEST_FILE_A, kind: 'file'},
				{type: 'add', disknode: undefined, id: TEST_FILE_B, kind: 'file'}, // No node
				{type: 'update', disknode: node_b, id: TEST_FILE_C, kind: 'file'},
			];

			const batch = new Filer_Change_Batch(changes);
			const added = batch.added;

			expect(added).toHaveLength(1);
			expect(added[0]).toBe(node_a);
		});

		test('updated returns only update changes with disknodes', () => {
			const filer = create_mock_filer();
			const node_a = new Disknode(TEST_FILE_A, filer);
			const node_b = new Disknode(TEST_FILE_B, filer);

			const changes: Array<Filer_Change> = [
				{type: 'add', disknode: node_a, id: TEST_FILE_A, kind: 'file'},
				{type: 'update', disknode: node_b, id: TEST_FILE_B, kind: 'file'},
				{type: 'update', disknode: undefined, id: TEST_FILE_C, kind: 'file'}, // No node
			];

			const batch = new Filer_Change_Batch(changes);
			const updated = batch.updated;

			expect(updated).toHaveLength(1);
			expect(updated[0]).toBe(node_b);
		});

		test('deleted returns only delete change IDs', () => {
			const filer = create_mock_filer();
			const node_a = new Disknode(TEST_FILE_A, filer);

			const changes: Array<Filer_Change> = [
				{type: 'add', disknode: node_a, id: TEST_FILE_A, kind: 'file'},
				{type: 'delete', disknode: undefined, id: TEST_FILE_B, kind: 'file'},
				{type: 'delete', disknode: undefined, id: TEST_FILE_C, kind: 'directory'},
			];

			const batch = new Filer_Change_Batch(changes);
			const deleted = batch.deleted;

			expect(deleted).toHaveLength(2);
			expect(deleted).toContain(TEST_FILE_B);
			expect(deleted).toContain(TEST_FILE_C);
		});

		test('all_disknodes returns all disknodes from add and update changes', () => {
			const filer = create_mock_filer();
			const node_a = new Disknode(TEST_FILE_A, filer);
			const node_b = new Disknode(TEST_FILE_B, filer);

			const changes: Array<Filer_Change> = [
				{type: 'add', disknode: node_a, id: TEST_FILE_A, kind: 'file'},
				{type: 'update', disknode: node_b, id: TEST_FILE_B, kind: 'file'},
				{type: 'delete', disknode: undefined, id: TEST_FILE_C, kind: 'file'},
				{type: 'add', disknode: undefined, id: TEST_DIR, kind: 'directory'}, // No node
			];

			const batch = new Filer_Change_Batch(changes);
			const all_disknodes = batch.all_disknodes;

			expect(all_disknodes).toHaveLength(2);
			expect(all_disknodes).toContain(node_a);
			expect(all_disknodes).toContain(node_b);
		});

		test('handles mixed file types and change types', () => {
			const filer = create_mock_filer();
			const file_node = new Disknode(TEST_FILE_A, filer);
			const dir_node = new Disknode(TEST_DIR, filer);

			const changes: Array<Filer_Change> = [
				{type: 'add', disknode: file_node, id: TEST_FILE_A, kind: 'file'},
				{type: 'update', disknode: dir_node, id: TEST_DIR, kind: 'directory'},
				{type: 'delete', disknode: undefined, id: TEST_FILE_B, kind: 'file'},
				{type: 'delete', disknode: undefined, id: TEST_FILE_C, kind: 'directory'},
			];

			const batch = new Filer_Change_Batch(changes);

			expect(batch.added).toEqual([file_node]);
			expect(batch.updated).toEqual([dir_node]);
			expect(batch.deleted).toHaveLength(2);
			expect(batch.deleted).toContain(TEST_FILE_B);
			expect(batch.deleted).toContain(TEST_FILE_C);
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
				{type: 'delete', disknode: undefined, id: TEST_FILE_A, kind: 'file'},
				{type: 'delete', disknode: undefined, id: TEST_FILE_B, kind: 'directory'},
			];

			const batch = new Filer_Change_Batch(changes);

			expect(batch.added).toEqual([]);
			expect(batch.updated).toEqual([]);
			expect(batch.deleted).toEqual([TEST_FILE_A, TEST_FILE_B]);
			expect(batch.all_disknodes).toEqual([]);
		});

		test('maintains order from map iteration', () => {
			const filer = create_mock_filer();
			const node_a = new Disknode(TEST_FILE_A, filer);
			const node_b = new Disknode(TEST_FILE_B, filer);
			const node_c = new Disknode(TEST_FILE_C, filer);

			const changes: Array<Filer_Change> = [
				{type: 'add', disknode: node_a, id: TEST_FILE_A, kind: 'file'},
				{type: 'add', disknode: node_b, id: TEST_FILE_B, kind: 'file'},
				{type: 'add', disknode: node_c, id: TEST_FILE_C, kind: 'file'},
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

	describe('edge cases', () => {
		test('handles changes without disknodes gracefully', () => {
			const changes: Array<Filer_Change> = [
				{type: 'add', disknode: undefined, id: TEST_FILE_A, kind: 'file'},
				{type: 'update', disknode: undefined, id: TEST_FILE_B, kind: 'file'},
			];

			const batch = new Filer_Change_Batch(changes);

			expect(batch.added).toEqual([]);
			expect(batch.updated).toEqual([]);
			expect(batch.all_disknodes).toEqual([]);
			expect(batch.size).toBe(2);
		});

		test('handles symlink changes', () => {
			const filer = create_mock_filer();
			const symlink_node = new Disknode(TEST_FILE_A, filer);

			const changes: Array<Filer_Change> = [
				{type: 'add', disknode: symlink_node, id: TEST_FILE_A, kind: 'symlink'},
				{type: 'delete', disknode: undefined, id: TEST_FILE_B, kind: 'symlink'},
			];

			const batch = new Filer_Change_Batch(changes);

			expect(batch.added).toEqual([symlink_node]);
			expect(batch.deleted).toEqual([TEST_FILE_B]);
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
	});
});
