// @slop Claude Sonnet 4

import {describe, test, expect, vi} from 'vitest';

import type {Filer_Observer} from './filer_helpers.ts';
import {use_filer_test_context, create_mock_stats, TEST_PATHS} from './filer.test_helpers.ts';

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

describe('Filer Parent-Child Relationships', () => {
	const ctx = use_filer_test_context();

	describe('deep directory hierarchies', () => {
		test('correctly sets up relationships in deep directory hierarchies', async () => {
			const filer = await ctx.create_mounted_filer({paths: ['/test'], batch_delay: 0});

			const deep_path = '/test/very/deep/nested/structure/file.ts';
			ctx.mock_watcher.emit('add', deep_path, create_mock_stats());
			await new Promise((resolve) => setTimeout(resolve, 20));

			const file_node = filer.get_disknode(deep_path);

			// Verify complete parent chain
			let current = file_node;
			const expected_chain = [
				'/test/very/deep/nested/structure/file.ts',
				'/test/very/deep/nested/structure',
				'/test/very/deep/nested',
				'/test/very/deep',
				'/test/very',
				'/test',
			];

			for (const expected_path of expected_chain) {
				expect(current.id).toBe(expected_path);
				if (current.parent && expected_path !== '/test') {
					const child_name = expected_path.split('/').pop();
					expect(current.parent.children.has(child_name!)).toBe(true);
					expect(current.parent.children.get(child_name!)).toBe(current);
					current = current.parent;
				}
			}

			// Root parent should be null
			const root_test = filer.get_disknode('/test');
			expect(root_test.parent?.id).toBe('/');
		});

		test('handles complex directory structures with multiple files', async () => {
			const filer = await ctx.create_mounted_filer({paths: [TEST_PATHS.SOURCE], batch_delay: 0});

			const paths = [
				`${TEST_PATHS.SOURCE}/utils/helper.ts`,
				`${TEST_PATHS.SOURCE}/utils/format.ts`,
				`${TEST_PATHS.SOURCE}/components/Button.ts`,
				`${TEST_PATHS.SOURCE}/components/Modal.ts`,
			];

			// Add all files
			for (const path of paths) {
				ctx.mock_watcher.emit('add', path, create_mock_stats());
			}
			await new Promise((resolve) => setTimeout(resolve, 30));

			// Verify utils directory
			const utils_dir = filer.get_disknode(`${TEST_PATHS.SOURCE}/utils`);
			expect(utils_dir.kind).toBe('directory');
			expect(utils_dir.children.size).toBe(2);
			expect(utils_dir.children.has('helper.ts')).toBe(true);
			expect(utils_dir.children.has('format.ts')).toBe(true);

			// Verify components directory
			const components_dir = filer.get_disknode(`${TEST_PATHS.SOURCE}/components`);
			expect(components_dir.kind).toBe('directory');
			expect(components_dir.children.size).toBe(2);
			expect(components_dir.children.has('Button.ts')).toBe(true);
			expect(components_dir.children.has('Modal.ts')).toBe(true);

			// Verify parent-child consistency
			for (const path of paths) {
				const file_node = filer.get_disknode(path);
				const file_name = path.split('/').pop()!;
				expect(file_node.parent!.children.get(file_name)).toBe(file_node);
			}
		});
	});

	describe('memory management', () => {
		test('prevents memory leaks from redundant relationship references', async () => {
			const filer = await ctx.create_mounted_filer({paths: [TEST_PATHS.SOURCE], batch_delay: 0});

			// Create and destroy many files
			for (let i = 0; i < 50; i++) {
				const path = `/test/project/src/temp${i}.ts`;
				ctx.mock_watcher.emit('add', path, create_mock_stats());
				ctx.mock_watcher.emit('unlink', path);
			}
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Parent should not accumulate stale references
			const parent = filer.get_disknode(TEST_PATHS.SOURCE);
			expect(parent.children.size).toBe(0);

			// Check that deleted files are properly handled
			for (let i = 0; i < 50; i++) {
				const temp_id = `/test/project/src/temp${i}.ts`;
				const temp_node = filer.get_by_id(temp_id);

				if (temp_node) {
					// File should be marked as not existing
					expect(temp_node.exists).toBe(false);

					// The important thing is it's not in the parent's children map
					expect(parent.children.has(`temp${i}.ts`)).toBe(false);
				}
			}

			// Most importantly: parent's children map should be clean
			// (no references to deleted temporary files)
			for (const [child_name, child_node] of parent.children) {
				expect(child_node.exists).toBe(true);
				expect(child_name.startsWith('temp')).toBe(false);
			}
		});

		test('handles bulk file operations efficiently', async () => {
			const filer = await ctx.create_mounted_filer({paths: [TEST_PATHS.SOURCE], batch_delay: 0});

			const file_count = 200;
			const start_time = Date.now();

			// Create many files
			for (let i = 0; i < file_count; i++) {
				ctx.mock_watcher.emit('add', `/test/project/src/bulk${i}.ts`, create_mock_stats());
			}
			await new Promise((resolve) => setTimeout(resolve, 100));

			const setup_time = Date.now() - start_time;

			// Should complete in reasonable time
			expect(setup_time).toBeLessThan(2000);

			const parent = filer.get_disknode(TEST_PATHS.SOURCE);
			expect(parent.children.size).toBe(file_count);

			// Verify relationships are all correct
			for (let i = 0; i < 10; i++) {
				// Sample check 10 random files
				const idx = Math.floor(Math.random() * file_count);
				const file_node = filer.get_disknode(`/test/project/src/bulk${idx}.ts`);
				expect(file_node.parent).toBe(parent);
				expect(parent.children.get(`bulk${idx}.ts`)).toBe(file_node);
			}
		});
	});

	describe('observer integration with relationships', () => {
		test('relationship setup works correctly with observers watching files', async () => {
			const observer: Filer_Observer = {
				id: 'file_watcher',
				patterns: [/\.ts$/], // Watch .ts files
				on_change: vi.fn(),
			};

			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
				observers: [observer],
			});

			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A, create_mock_stats());
			await new Promise((resolve) => setTimeout(resolve, 20));

			// Observer should have been called for the file
			expect(vi.mocked(observer.on_change)).toHaveBeenCalled();

			// Verify relationships are correctly set up
			const parent = filer.get_disknode(TEST_PATHS.SOURCE);
			const child = filer.get_disknode(TEST_PATHS.FILE_A);
			expect(parent.children.has('a.ts')).toBe(true);
			expect(child.parent).toBe(parent);

			// Verify the observer got the file in the batch
			const batch = vi.mocked(observer.on_change).mock.calls[0][0];
			expect(batch.has(TEST_PATHS.FILE_A)).toBe(true);
		});

		test('relationship setup works correctly with directory observers', async () => {
			const observer: Filer_Observer = {
				id: 'directory_watcher',
				patterns: [/\/src$/], // Watch parent directory
				track_directories: true,
				on_change: vi.fn(),
			};

			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
				observers: [observer],
			});

			// Emit directory event to trigger the observer
			ctx.mock_watcher.emit('addDir', TEST_PATHS.SOURCE);
			await new Promise((resolve) => setTimeout(resolve, 20));

			// Observer should have been called for the directory
			expect(vi.mocked(observer.on_change)).toHaveBeenCalled();

			// Now add a child file
			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A, create_mock_stats());
			await new Promise((resolve) => setTimeout(resolve, 20));

			// Verify relationships are correctly set up
			const parent = filer.get_disknode(TEST_PATHS.SOURCE);
			const child = filer.get_disknode(TEST_PATHS.FILE_A);
			expect(parent.children.has('a.ts')).toBe(true);
			expect(child.parent).toBe(parent);
		});

		test('handles parent directory changes affecting children', async () => {
			const observer: Filer_Observer = {
				id: 'child_tracker',
				patterns: [/\.ts$/],
				on_change: vi.fn(),
			};

			const filer = await ctx.create_mounted_filer({
				paths: [TEST_PATHS.SOURCE],
				batch_delay: 0,
				observers: [observer],
			});

			// Add child first
			ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A, create_mock_stats());
			await new Promise((resolve) => setTimeout(resolve, 10));

			const child = filer.get_disknode(TEST_PATHS.FILE_A);
			const parent = filer.get_disknode(TEST_PATHS.SOURCE);

			expect(child.parent).toBe(parent);
			expect(parent.children.get('a.ts')).toBe(child);

			// Directory operations don't break the existing relationships
			// (In a real filesystem, directory deletion would also delete children,
			// but we're testing the relationship consistency)
			const relationship_before_dir_ops = {
				child_parent: child.parent,
				parent_has_child: parent.children.get('a.ts'),
			};

			// Directory operations
			ctx.mock_watcher.emit('unlinkDir', TEST_PATHS.SOURCE);
			ctx.mock_watcher.emit('addDir', TEST_PATHS.SOURCE);
			await new Promise((resolve) => setTimeout(resolve, 20));

			// File relationships should remain consistent
			expect(child.parent).toBe(relationship_before_dir_ops.child_parent);
			expect(parent.children.get('a.ts')).toBe(relationship_before_dir_ops.parent_has_child);
		});
	});

	describe('edge cases and error conditions', () => {
		test('handles files with unusual characters in names', async () => {
			const filer = await ctx.create_mounted_filer({paths: [TEST_PATHS.SOURCE], batch_delay: 0});

			const unusual_files = [
				`${TEST_PATHS.SOURCE}/file with spaces.ts`,
				`${TEST_PATHS.SOURCE}/file-with-dashes.ts`,
				`${TEST_PATHS.SOURCE}/file.with.dots.ts`,
				`${TEST_PATHS.SOURCE}/file_with_underscores.ts`,
			];

			for (const path of unusual_files) {
				ctx.mock_watcher.emit('add', path, create_mock_stats());
			}
			await new Promise((resolve) => setTimeout(resolve, 30));

			const parent = filer.get_disknode(TEST_PATHS.SOURCE);
			expect(parent.children.size).toBe(4);

			// Verify each file has correct relationship
			for (const path of unusual_files) {
				const file_node = filer.get_disknode(path);
				const file_name = path.split('/').pop()!;
				expect(file_node.parent).toBe(parent);
				expect(parent.children.get(file_name)).toBe(file_node);
			}
		});

		test('handles concurrent directory creation and file addition', async () => {
			const filer = await ctx.create_mounted_filer({paths: [TEST_PATHS.SOURCE], batch_delay: 0});

			const new_dir = `${TEST_PATHS.SOURCE}/newdir`;
			const new_file = `${new_dir}/newfile.ts`;

			// Add directory and file simultaneously (race condition)
			ctx.mock_watcher.emit('addDir', new_dir);
			ctx.mock_watcher.emit('add', new_file, create_mock_stats());
			await new Promise((resolve) => setTimeout(resolve, 20));

			const dir_node = filer.get_disknode(new_dir);
			const file_node = filer.get_disknode(new_file);

			// Relationships should be correct despite race condition
			expect(file_node.parent).toBe(dir_node);
			expect(dir_node.children.get('newfile.ts')).toBe(file_node);
			expect(dir_node.kind).toBe('directory');
		});

		test('handles empty directory deletion and recreation', async () => {
			const filer = await ctx.create_mounted_filer({paths: [TEST_PATHS.SOURCE], batch_delay: 0});

			const empty_dir = `${TEST_PATHS.SOURCE}/emptydir`;

			// Create, delete, and recreate empty directory
			ctx.mock_watcher.emit('addDir', empty_dir);
			await new Promise((resolve) => setTimeout(resolve, 10));

			const first_dir = filer.get_disknode(empty_dir);
			expect(first_dir.children.size).toBe(0);

			ctx.mock_watcher.emit('unlinkDir', empty_dir);
			ctx.mock_watcher.emit('addDir', empty_dir);
			await new Promise((resolve) => setTimeout(resolve, 10));

			const second_dir = filer.get_disknode(empty_dir);
			expect(second_dir.children.size).toBe(0);
			expect(second_dir.exists).toBe(true);
		});

		test('maintains relationship consistency after multiple rapid changes', async () => {
			const filer = await ctx.create_mounted_filer({paths: [TEST_PATHS.SOURCE], batch_delay: 0});

			// Rapid sequence of changes
			const operations = [
				() => ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A, create_mock_stats()),
				() => ctx.mock_watcher.emit('change', TEST_PATHS.FILE_A, create_mock_stats()),
				() => ctx.mock_watcher.emit('unlink', TEST_PATHS.FILE_A),
				() => ctx.mock_watcher.emit('add', TEST_PATHS.FILE_A, create_mock_stats()),
				() => ctx.mock_watcher.emit('change', TEST_PATHS.FILE_A, create_mock_stats()),
			];

			// Execute operations rapidly
			for (const op of operations) {
				op();
				await new Promise((resolve) => setTimeout(resolve, 1)); // Very short delay
			}

			await new Promise((resolve) => setTimeout(resolve, 50));

			const file_node = filer.get_disknode(TEST_PATHS.FILE_A);
			const parent_node = filer.get_disknode(TEST_PATHS.SOURCE);

			// Final state should be consistent
			expect(file_node.parent).toBe(parent_node);
			expect(parent_node.children.get('a.ts')).toBe(file_node);
			expect(parent_node.children.size).toBe(1);
			expect(file_node.exists).toBe(true);
		});
	});
});
