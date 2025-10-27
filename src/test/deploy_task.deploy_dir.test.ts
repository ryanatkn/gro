import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest';
import {join, resolve} from 'node:path';

import {task as deploy_task} from '../lib/deploy.task.ts';
import {GIT_DIRNAME} from '../lib/constants.ts';

import {
	create_mock_deploy_task_context,
	setup_successful_git_mocks,
	setup_successful_fs_mocks,
	setup_successful_spawn_mock,
} from './deploy_task_test_helpers.ts';

/* eslint-disable @typescript-eslint/require-await */

// Mock dependencies
vi.mock('@ryanatkn/belt/git.js', async (import_original) => {
	const actual = await import_original<typeof import('@ryanatkn/belt/git.js')>();
	return {
		...actual,
		git_check_clean_workspace: vi.fn(),
		git_check_setting_pull_rebase: vi.fn(),
		git_local_branch_exists: vi.fn(),
		git_fetch: vi.fn(),
		git_checkout: vi.fn(),
		git_pull: vi.fn(),
		git_remote_branch_exists: vi.fn(),
		git_clone_locally: vi.fn(),
		git_current_branch_name: vi.fn(),
		git_delete_local_branch: vi.fn(),
		git_push_to_create: vi.fn(),
		git_reset_branch_to_first_commit: vi.fn(),
	};
});

vi.mock('@ryanatkn/belt/process.js', () => ({
	spawn: vi.fn(),
}));

vi.mock('node:fs', () => ({
	existsSync: vi.fn(),
	readdirSync: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
	cp: vi.fn(),
	mkdir: vi.fn(),
	rm: vi.fn(),
}));

vi.mock('../lib/fs.ts', () => ({
	empty_dir: vi.fn(),
}));

describe('deploy_task deploy directory operations', () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		await setup_successful_git_mocks();
		await setup_successful_fs_mocks();
		await setup_successful_spawn_mock();

		const {empty_dir} = vi.mocked(await import('../lib/fs.ts'));
		vi.mocked(empty_dir).mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	describe('deploy directory cleanup', () => {
		test('empties deploy_dir before copying build output', async () => {
			const {empty_dir} = vi.mocked(await import('../lib/fs.ts'));
			const {existsSync} = await import('node:fs');

			vi.mocked(existsSync).mockReturnValue(true);

			const ctx = create_mock_deploy_task_context({
				deploy_dir: '.gro/deploy',
				dry: true,
			});

			await deploy_task.run(ctx);

			// Should empty the deploy dir
			expect(empty_dir).toHaveBeenCalledWith(resolve('.gro/deploy'), expect.any(Function));
		});

		test('preserves .git directory when emptying deploy_dir', async () => {
			const {empty_dir} = vi.mocked(await import('../lib/fs.ts'));
			const {existsSync} = await import('node:fs');

			vi.mocked(existsSync).mockReturnValue(true);

			const ctx = create_mock_deploy_task_context({dry: true});

			await deploy_task.run(ctx);

			// Should pass a filter function that preserves .git
			expect(empty_dir).toHaveBeenCalled();
			const filter_fn = (empty_dir as any).mock.calls[0][1];
			expect(typeof filter_fn).toBe('function');

			// Filter returns false for paths to preserve (don't delete)
			expect(filter_fn(GIT_DIRNAME)).toBe(false);
			expect(filter_fn('.git')).toBe(false);
			// Filter returns true for paths to delete
			expect(filter_fn('index.html')).toBe(true);
			expect(filter_fn('assets')).toBe(true);
		});

		test('empty happens after target branch preparation', async () => {
			const {git_pull} = vi.mocked(await import('@ryanatkn/belt/git.js'));
			const {empty_dir} = vi.mocked(await import('../lib/fs.ts'));
			const {existsSync} = await import('node:fs');

			vi.mocked(existsSync).mockReturnValue(true);

			const ctx = create_mock_deploy_task_context({dry: true});

			await deploy_task.run(ctx);

			// empty_dir should be called after git operations
			const pull_order = git_pull.mock.invocationCallOrder[0]!;
			const empty_order = (empty_dir as any).mock.invocationCallOrder[0]!;

			expect(empty_order).toBeGreaterThan(pull_order);
		});

		test('empty happens before copying files', async () => {
			const {empty_dir} = vi.mocked(await import('../lib/fs.ts'));
			const {cp} = await import('node:fs/promises');
			const {existsSync} = await import('node:fs');

			vi.mocked(existsSync).mockReturnValue(true);

			const ctx = create_mock_deploy_task_context({dry: true});

			await deploy_task.run(ctx);

			// empty_dir should be called before cp
			const empty_order = (empty_dir as any).mock.invocationCallOrder[0];
			const cp_order = (cp as any).mock.invocationCallOrder[0];

			expect(empty_order).toBeLessThan(cp_order);
		});
	});

	describe('file copying', () => {
		test('copies all files from build_dir to deploy_dir', async () => {
			const {readdirSync} = await import('node:fs');
			const {cp} = await import('node:fs/promises');
			const {existsSync} = await import('node:fs');

			vi.mocked(existsSync).mockReturnValue(true);
			vi.mocked(readdirSync).mockReturnValue(['index.html', 'assets', 'favicon.ico'] as any);

			const ctx = create_mock_deploy_task_context({
				build_dir: 'build',
				deploy_dir: '.gro/deploy',
				dry: true,
			});

			await deploy_task.run(ctx);

			// Should copy each file/directory
			expect(cp).toHaveBeenCalledWith(
				join('build', 'index.html'),
				join(resolve('.gro/deploy'), 'index.html'),
				{recursive: true},
			);
			expect(cp).toHaveBeenCalledWith(
				join('build', 'assets'),
				join(resolve('.gro/deploy'), 'assets'),
				{
					recursive: true,
				},
			);
			expect(cp).toHaveBeenCalledWith(
				join('build', 'favicon.ico'),
				join(resolve('.gro/deploy'), 'favicon.ico'),
				{recursive: true},
			);
		});

		test('uses custom build_dir and deploy_dir paths', async () => {
			const {readdirSync} = await import('node:fs');
			const {cp} = await import('node:fs/promises');
			const {existsSync} = await import('node:fs');

			vi.mocked(existsSync).mockReturnValue(true);
			vi.mocked(readdirSync).mockReturnValue(['app.js'] as any);

			const ctx = create_mock_deploy_task_context({
				build_dir: 'dist',
				deploy_dir: 'custom/deploy',
				dry: true,
			});

			await deploy_task.run(ctx);

			expect(cp).toHaveBeenCalledWith(
				join('dist', 'app.js'),
				join(resolve('custom/deploy'), 'app.js'),
				{
					recursive: true,
				},
			);
		});

		test('copies directories recursively', async () => {
			const {readdirSync} = await import('node:fs');
			const {cp} = await import('node:fs/promises');
			const {existsSync} = await import('node:fs');

			vi.mocked(existsSync).mockReturnValue(true);
			vi.mocked(readdirSync).mockReturnValue(['assets'] as any);

			const ctx = create_mock_deploy_task_context({dry: true});

			await deploy_task.run(ctx);

			// Should copy with recursive flag
			expect(cp).toHaveBeenCalledWith(expect.anything(), expect.anything(), {recursive: true});
		});

		test('copies all files in parallel', async () => {
			const {readdirSync} = await import('node:fs');
			const {cp} = await import('node:fs/promises');
			const {existsSync} = await import('node:fs');

			vi.mocked(existsSync).mockReturnValue(true);
			vi.mocked(readdirSync).mockReturnValue(['file1.html', 'file2.html', 'file3.html'] as any);

			// Track when cp is called
			let concurrent_calls = 0;
			let max_concurrent = 0;
			vi.mocked(cp).mockImplementation(async () => {
				concurrent_calls++;
				max_concurrent = Math.max(max_concurrent, concurrent_calls);
				await new Promise((resolve) => setTimeout(resolve, 10));
				concurrent_calls--;
			});

			const ctx = create_mock_deploy_task_context({dry: true});

			await deploy_task.run(ctx);

			// All 3 files should have been copied with some concurrency
			expect(cp).toHaveBeenCalledTimes(3);
			expect(max_concurrent).toBeGreaterThan(1);
		});

		test('handles empty build directory', async () => {
			const {readdirSync} = await import('node:fs');
			const {cp} = await import('node:fs/promises');
			const {existsSync} = await import('node:fs');

			vi.mocked(existsSync).mockReturnValue(true);
			vi.mocked(readdirSync).mockReturnValue([] as any); // empty

			const ctx = create_mock_deploy_task_context({dry: true});

			await deploy_task.run(ctx);

			// Should not copy anything
			expect(cp).not.toHaveBeenCalled();
		});
	});

	describe('error handling', () => {
		test('propagates error when empty_dir fails', async () => {
			const {empty_dir} = vi.mocked(await import('../lib/fs.ts'));
			const {existsSync} = await import('node:fs');

			vi.mocked(existsSync).mockReturnValue(true);
			vi.mocked(empty_dir).mockRejectedValue(new Error('Permission denied'));

			const ctx = create_mock_deploy_task_context({dry: true});

			await expect(deploy_task.run(ctx)).rejects.toThrow('Permission denied');
		});

		test('propagates error when readdirSync fails', async () => {
			const {readdirSync} = await import('node:fs');
			const {existsSync} = await import('node:fs');

			vi.mocked(existsSync).mockReturnValue(true);
			vi.mocked(readdirSync).mockImplementation(() => {
				throw new Error('Cannot read directory');
			});

			const ctx = create_mock_deploy_task_context({dry: true});

			await expect(deploy_task.run(ctx)).rejects.toThrow('Cannot read directory');
		});

		test('propagates error when cp fails', async () => {
			const {readdirSync} = await import('node:fs');
			const {cp} = await import('node:fs/promises');
			const {existsSync} = await import('node:fs');

			vi.mocked(existsSync).mockReturnValue(true);
			vi.mocked(readdirSync).mockReturnValue(['index.html'] as any);
			vi.mocked(cp).mockRejectedValue(new Error('Disk full'));

			const ctx = create_mock_deploy_task_context({dry: true});

			await expect(deploy_task.run(ctx)).rejects.toThrow('Disk full');
		});

		test('fails if any parallel copy fails', async () => {
			const {readdirSync} = await import('node:fs');
			const {cp} = await import('node:fs/promises');
			const {existsSync} = await import('node:fs');

			vi.mocked(existsSync).mockReturnValue(true);
			vi.mocked(readdirSync).mockReturnValue(['file1.html', 'file2.html', 'file3.html'] as any);

			// Second copy fails
			let call_count = 0;
			vi.mocked(cp).mockImplementation(async () => {
				call_count++;
				if (call_count === 2) {
					throw new Error('Copy failed');
				}
			});

			const ctx = create_mock_deploy_task_context({dry: true});

			await expect(deploy_task.run(ctx)).rejects.toThrow('Copy failed');
		});
	});
});
