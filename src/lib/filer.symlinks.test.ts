// @slop Claude Sonnet 4

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

describe('Filer Symlink Relationship Handling', () => {
	const ctx = use_filer_test_context();

	describe('basename usage for child map keys', () => {
		test('uses basename of disknode.id for child map keys (not target)', async () => {
			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
			});

			const parent_path = '/test/project/src';
			const child_path = '/test/project/src/config.json';

			// Add a file with a specific name
			ctx.mock_watcher.emit('add', child_path);
			await new Promise((resolve) => setTimeout(resolve, 10));

			const parent = filer.get_disknode(parent_path);
			const child = filer.get_disknode(child_path);

			// Parent should use basename of child's ID for the map key
			expect(parent.children.has('config.json')).toBe(true);
			expect(parent.children.get('config.json')).toBe(child);

			// The comment in the original code clarifies this is "the entry name as seen by the parent directory"
			// This test verifies that basename(disknode.id) is used consistently
		});

		test('handles files with same basename in different directories', async () => {
			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
			});

			const dir_a = '/test/project/src/dir_a';
			const dir_b = '/test/project/src/dir_b';
			const file_a = '/test/project/src/dir_a/config.json';
			const file_b = '/test/project/src/dir_b/config.json';

			// Create parent directories first
			filer.get_disknode(dir_a).kind = 'directory';
			filer.get_disknode(dir_b).kind = 'directory';

			// Add both files with same basename
			ctx.mock_watcher.emit('add', file_a);
			ctx.mock_watcher.emit('add', file_b);
			await new Promise((resolve) => setTimeout(resolve, 10));

			const dir_a_node = filer.get_disknode(dir_a);
			const dir_b_node = filer.get_disknode(dir_b);
			const file_a_node = filer.get_disknode(file_a);
			const file_b_node = filer.get_disknode(file_b);

			// Both directories should have a child named "config.json"
			expect(dir_a_node.children.has('config.json')).toBe(true);
			expect(dir_b_node.children.has('config.json')).toBe(true);

			// Each should point to their respective file node
			expect(dir_a_node.children.get('config.json')).toBe(file_a_node);
			expect(dir_b_node.children.get('config.json')).toBe(file_b_node);

			// Files are distinct even though they have same basename
			expect(file_a_node).not.toBe(file_b_node);
		});

		test('correctly handles file deletion from parent children map', async () => {
			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
			});

			const parent_path = '/test/project/src';
			const file_path = '/test/project/src/temp.ts';

			// Add file
			ctx.mock_watcher.emit('add', file_path);
			await new Promise((resolve) => setTimeout(resolve, 10));

			const parent = filer.get_disknode(parent_path);

			// Verify file is in parent's children
			expect(parent.children.has('temp.ts')).toBe(true);

			// Delete file
			ctx.mock_watcher.emit('unlink', file_path);
			await new Promise((resolve) => setTimeout(resolve, 10));

			// File should be removed from parent's children map
			// This tests that basename(disknode.id) is used consistently for both add and delete
			expect(parent.children.has('temp.ts')).toBe(false);
		});

		test('basename usage is consistent for complex paths', async () => {
			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
			});

			const complex_path = '/test/project/src/deeply/nested/path/file.with.dots.ts';

			// Add file
			ctx.mock_watcher.emit('add', complex_path);
			await new Promise((resolve) => setTimeout(resolve, 10));

			const parent = filer.get_disknode('/test/project/src/deeply/nested/path');
			const file = filer.get_disknode(complex_path);

			// Parent should use basename for child map key
			expect(parent.children.has('file.with.dots.ts')).toBe(true);
			expect(parent.children.get('file.with.dots.ts')).toBe(file);
		});
	});
});
