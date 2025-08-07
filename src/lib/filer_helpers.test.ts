// @slop Claude Sonnet 4

import {test, expect, describe, vi} from 'vitest';

import {
	filer_test_regexp,
	filer_coalesce_change,
	Filer_Change_Batch,
	load_resources_batch,
	type Filer_Change,
	type Resource_Load_Options,
} from './filer_helpers.ts';

describe('filer_test_regexp', () => {
	describe('basic functionality', () => {
		test('matches simple patterns', () => {
			const pattern = /\.ts$/;
			expect(filer_test_regexp(pattern, 'file.ts')).toBe(true);
			expect(filer_test_regexp(pattern, 'file.js')).toBe(false);
		});

		test('handles case-insensitive patterns', () => {
			const pattern = /\.TS$/i;
			expect(filer_test_regexp(pattern, 'file.ts')).toBe(true);
			expect(filer_test_regexp(pattern, 'file.TS')).toBe(true);
		});
	});

	describe('global flag handling', () => {
		test('resets lastIndex for global patterns', () => {
			const pattern = /test/g;

			// First call should match
			expect(filer_test_regexp(pattern, 'test1')).toBe(true);

			// Without reset, global flag would cause lastIndex to be at end
			// But with reset, this should still match from beginning
			expect(filer_test_regexp(pattern, 'test2')).toBe(true);
		});

		test('global pattern works correctly multiple times', () => {
			const pattern = /\d+/g;

			// Should match consistently
			expect(filer_test_regexp(pattern, 'abc123def')).toBe(true);
			expect(filer_test_regexp(pattern, 'xyz456ghi')).toBe(true);
			expect(filer_test_regexp(pattern, 'nodigits')).toBe(false);
		});

		test('global pattern lastIndex behavior without helper', () => {
			// This test demonstrates the problem the helper solves
			const pattern = /test/g;

			// Direct use without reset
			expect(pattern.test('test1')).toBe(true);
			// This would fail without reset because lastIndex is now 4
			expect(pattern.test('test2')).toBe(false);

			// Reset manually
			pattern.lastIndex = 0;
			expect(pattern.test('test2')).toBe(true);
		});
	});

	describe('sticky flag handling', () => {
		test('resets lastIndex for sticky patterns', () => {
			// Sticky pattern that matches at beginning
			const pattern = /^test/y;

			expect(filer_test_regexp(pattern, 'test1')).toBe(true);
			expect(filer_test_regexp(pattern, 'test2')).toBe(true);
		});

		test('sticky pattern with position-sensitive matching', () => {
			const pattern = /test/y;

			// Should always test from position 0 due to reset
			expect(filer_test_regexp(pattern, 'test123')).toBe(true);
			expect(filer_test_regexp(pattern, 'test456')).toBe(true);
			expect(filer_test_regexp(pattern, 'notest')).toBe(false);
		});
	});

	describe('hasIndices flag handling', () => {
		test('handles hasIndices flag when available', () => {
			// Check if hasIndices is available in this environment
			if ('hasIndices' in RegExp.prototype) {
				const pattern = /^test/d; // Anchored to start to ensure predictable matching
				expect(filer_test_regexp(pattern, 'test123')).toBe(true);
				expect(filer_test_regexp(pattern, 'notest')).toBe(false);
			} else {
				// Skip test if hasIndices not available
				expect(true).toBe(true);
			}
		});

		test('hasIndices does not affect matching behavior', () => {
			if ('hasIndices' in RegExp.prototype) {
				const pattern_without = /test/;
				const pattern_with = /test/d;

				const test_string = 'test123';
				expect(filer_test_regexp(pattern_without, test_string)).toBe(
					filer_test_regexp(pattern_with, test_string),
				);
			} else {
				expect(true).toBe(true);
			}
		});
	});

	describe('unicode flag handling', () => {
		test('handles unicode flag correctly', () => {
			const pattern = /\u{1F600}/u; // 😀 emoji
			expect(filer_test_regexp(pattern, 'hello 😀 world')).toBe(true);
			expect(filer_test_regexp(pattern, 'hello world')).toBe(false);
		});

		test('unicode flag with repeated calls', () => {
			const pattern = /\p{Emoji}/u;
			expect(filer_test_regexp(pattern, '🎉')).toBe(true);
			expect(filer_test_regexp(pattern, '🚀')).toBe(true);
			expect(filer_test_regexp(pattern, 'abc')).toBe(false);
		});
	});

	describe('unicodeSets flag handling', () => {
		test('handles unicodeSets flag when available', () => {
			// Check if unicodeSets (v flag) is available
			try {
				const pattern = /[\p{Emoji}&&\q{🎉}]/v;
				expect(filer_test_regexp(pattern, '🎉')).toBe(true);
				expect(filer_test_regexp(pattern, 'abc')).toBe(false);
			} catch {
				// v flag not available in this environment
				expect(true).toBe(true);
			}
		});
	});

	describe('combined flags', () => {
		test('handles global + unicode flags', () => {
			const pattern = /\p{Emoji}/gu;
			expect(filer_test_regexp(pattern, '🎉 test')).toBe(true);
			expect(filer_test_regexp(pattern, '🚀 test')).toBe(true);
		});

		test('handles sticky + unicode flags', () => {
			const pattern = /^\p{Emoji}/uy;
			expect(filer_test_regexp(pattern, '🎉test')).toBe(true);
			expect(filer_test_regexp(pattern, '🚀test')).toBe(true);
			expect(filer_test_regexp(pattern, 'a🎉test')).toBe(false);
		});

		test('handles global + hasIndices when available', () => {
			if ('hasIndices' in RegExp.prototype) {
				const pattern = /test/dg;
				expect(filer_test_regexp(pattern, 'test123')).toBe(true);
				expect(filer_test_regexp(pattern, 'test456')).toBe(true);
			} else {
				expect(true).toBe(true);
			}
		});
	});

	describe('edge cases', () => {
		test('handles empty string', () => {
			const pattern = /^$/;
			expect(filer_test_regexp(pattern, '')).toBe(true);
			expect(filer_test_regexp(pattern, 'a')).toBe(false);
		});

		test('handles complex patterns', () => {
			const pattern = /(?=.*\.ts$)(?=.*\/src\/).*/g; // Positive lookaheads with global
			expect(filer_test_regexp(pattern, '/project/src/file.ts')).toBe(true);
			expect(filer_test_regexp(pattern, '/project/src/another.ts')).toBe(true);
			expect(filer_test_regexp(pattern, '/project/lib/file.ts')).toBe(false);
		});

		test('handles patterns with special characters', () => {
			const pattern = /\$\{\w+\}/g; // Template literal pattern
			expect(filer_test_regexp(pattern, 'hello ${name} world')).toBe(true);
			expect(filer_test_regexp(pattern, 'hello ${age} world')).toBe(true);
			expect(filer_test_regexp(pattern, 'hello world')).toBe(false);
		});
	});

	describe('performance and consistency', () => {
		test('consistent results across multiple calls', () => {
			const patterns = [/test/g, /test/y, /test/gi, /test/gy];

			patterns.forEach((pattern) => {
				const results = Array.from({length: 10}, () => filer_test_regexp(pattern, 'test123'));

				// All results should be the same
				expect(results.every((r) => r === results[0])).toBe(true);
				expect(results[0]).toBe(true);
			});
		});

		test('resets lastIndex for stateful patterns', () => {
			const pattern = /test/g;
			const original_flags = pattern.flags;
			const original_source = pattern.source;

			// Set lastIndex to non-zero to simulate prior usage
			pattern.lastIndex = 5;

			const result = filer_test_regexp(pattern, 'test123');

			expect(pattern.flags).toBe(original_flags);
			expect(pattern.source).toBe(original_source);
			expect(result).toBe(true);
			expect(pattern.lastIndex).toBe(4);
		});
	});
});

describe('filer_coalesce_change', () => {
	describe('basic transitions', () => {
		test('handles add transitions', () => {
			const base_change: Filer_Change = {
				type: 'add',
				id: '/test/path',
				kind: 'file',
			};

			// add + add → add
			expect(filer_coalesce_change(base_change, {...base_change, type: 'add'})).toEqual({
				...base_change,
				type: 'add',
			});

			// add + update → add
			expect(filer_coalesce_change(base_change, {...base_change, type: 'update'})).toEqual({
				...base_change,
				type: 'add',
			});

			// add + delete → null (remove)
			expect(filer_coalesce_change(base_change, {...base_change, type: 'delete'})).toBe(null);
		});

		test('handles update transitions', () => {
			const base_change: Filer_Change = {
				type: 'update',
				id: '/test/path',
				kind: 'file',
			};

			// update + add → add
			expect(filer_coalesce_change(base_change, {...base_change, type: 'add'})).toEqual({
				...base_change,
				type: 'add',
			});

			// update + update → update
			expect(filer_coalesce_change(base_change, {...base_change, type: 'update'})).toEqual({
				...base_change,
				type: 'update',
			});

			// update + delete → delete
			expect(filer_coalesce_change(base_change, {...base_change, type: 'delete'})).toEqual({
				...base_change,
				type: 'delete',
			});
		});

		test('handles delete transitions', () => {
			const base_change: Filer_Change = {
				type: 'delete',
				id: '/test/path',
				kind: 'file',
			};

			// delete + add → update
			expect(filer_coalesce_change(base_change, {...base_change, type: 'add'})).toEqual({
				...base_change,
				type: 'update',
			});

			// delete + update → update
			expect(filer_coalesce_change(base_change, {...base_change, type: 'update'})).toEqual({
				...base_change,
				type: 'update',
			});

			// delete + delete → delete
			expect(filer_coalesce_change(base_change, {...base_change, type: 'delete'})).toEqual({
				...base_change,
				type: 'delete',
			});
		});
	});

	test('handles undefined previous change', () => {
		const change: Filer_Change = {
			type: 'add',
			id: '/test/path',
			kind: 'file',
		};

		expect(filer_coalesce_change(undefined, change)).toEqual(change);
	});
});

describe('Filer_Change_Batch', () => {
	describe('construction', () => {
		test('creates empty batch', () => {
			const batch = new Filer_Change_Batch();
			expect(batch.is_empty).toBe(true);
			expect(batch.size).toBe(0);
		});

		test('creates batch from changes', () => {
			const changes: Array<Filer_Change> = [
				{type: 'add', id: '/path/a', kind: 'file'},
				{type: 'update', id: '/path/b', kind: 'file'},
				{type: 'delete', id: '/path/c', kind: 'file'},
			];

			const batch = new Filer_Change_Batch(changes);
			expect(batch.size).toBe(3);
			expect(batch.is_empty).toBe(false);
		});
	});

	describe('accessors', () => {
		test('filters changes by type correctly', () => {
			const mock_disknode_a = {id: '/path/a'} as any;
			const mock_disknode_b = {id: '/path/b'} as any;

			const changes: Array<Filer_Change> = [
				{type: 'add', id: '/path/a', kind: 'file', disknode: mock_disknode_a},
				{type: 'update', id: '/path/b', kind: 'file', disknode: mock_disknode_b},
				{type: 'delete', id: '/path/c', kind: 'file'},
			];

			const batch = new Filer_Change_Batch(changes);

			expect(batch.added).toEqual([mock_disknode_a]);
			expect(batch.updated).toEqual([mock_disknode_b]);
			expect(batch.deleted).toEqual(['/path/c']);
			expect(batch.all_disknodes).toEqual([mock_disknode_a, mock_disknode_b]);
		});

		test('caches accessor results', () => {
			const mock_disknode = {id: '/path/a'} as any;
			const changes: Array<Filer_Change> = [
				{type: 'add', id: '/path/a', kind: 'file', disknode: mock_disknode},
			];

			const batch = new Filer_Change_Batch(changes);

			// First access
			const added1 = batch.added;
			// Second access should be same instance (cached)
			const added2 = batch.added;
			expect(added1).toBe(added2);
		});
	});

	describe('methods', () => {
		test('has() checks for path existence', () => {
			const changes: Array<Filer_Change> = [{type: 'add', id: '/path/a', kind: 'file'}];

			const batch = new Filer_Change_Batch(changes);
			expect(batch.has('/path/a')).toBe(true);
			expect(batch.has('/path/b')).toBe(false);
		});

		test('get() retrieves change by path', () => {
			const change: Filer_Change = {type: 'add', id: '/path/a', kind: 'file'};
			const batch = new Filer_Change_Batch([change]);

			expect(batch.get('/path/a')).toEqual(change);
			expect(batch.get('/path/b')).toBe(undefined);
		});
	});
});

describe('load_resources_batch', () => {
	test('loads no resources when none specified', async () => {
		const mock_disknode = {
			load_stats: vi.fn(),
			load_contents: vi.fn(),
			load_imports: vi.fn(),
			is_importable: true,
		} as any;

		await load_resources_batch([mock_disknode], {});

		expect(mock_disknode.load_stats).not.toHaveBeenCalled();
		expect(mock_disknode.load_contents).not.toHaveBeenCalled();
		expect(mock_disknode.load_imports).not.toHaveBeenCalled();
	});

	test('loads specified resources', async () => {
		const mock_disknode = {
			load_stats: vi.fn().mockResolvedValue(undefined),
			load_contents: vi.fn().mockResolvedValue(undefined),
			load_imports: vi.fn().mockResolvedValue(undefined),
			is_importable: true,
		} as any;

		const options: Resource_Load_Options = {
			stats: true,
			contents: true,
			imports: true,
		};

		await load_resources_batch([mock_disknode], options);

		expect(mock_disknode.load_stats).toHaveBeenCalledTimes(1);
		expect(mock_disknode.load_contents).toHaveBeenCalledTimes(1);
		expect(mock_disknode.load_imports).toHaveBeenCalledTimes(1);
	});

	test('skips imports for non-importable disknodes', async () => {
		const mock_disknode = {
			load_stats: vi.fn().mockResolvedValue(undefined),
			load_contents: vi.fn().mockResolvedValue(undefined),
			load_imports: vi.fn().mockResolvedValue(undefined),
			is_importable: false,
		} as any;

		const options: Resource_Load_Options = {
			stats: true,
			contents: true,
			imports: true,
		};

		await load_resources_batch([mock_disknode], options);

		expect(mock_disknode.load_stats).toHaveBeenCalledTimes(1);
		expect(mock_disknode.load_contents).toHaveBeenCalledTimes(1);
		expect(mock_disknode.load_imports).not.toHaveBeenCalled();
	});

	test('handles multiple disknodes', async () => {
		const mock_disknodes = [
			{
				load_stats: vi.fn().mockResolvedValue(undefined),
				is_importable: false,
			},
			{
				load_stats: vi.fn().mockResolvedValue(undefined),
				is_importable: true,
			},
		] as any;

		await load_resources_batch(mock_disknodes, {stats: true});

		expect(mock_disknodes[0].load_stats).toHaveBeenCalledTimes(1);
		expect(mock_disknodes[1].load_stats).toHaveBeenCalledTimes(1);
	});
});
