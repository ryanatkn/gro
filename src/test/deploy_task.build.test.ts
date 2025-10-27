import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest';

import {task as deploy_task} from '../lib/deploy.task.ts';
import {Task_Error} from '../lib/task.ts';

import {
	create_mock_deploy_task_context,
	setup_successful_git_mocks,
	setup_successful_fs_mocks,
	setup_successful_spawn_mock,
} from './deploy_task_test_helpers.ts';

// Mock dependencies
vi.mock('@ryanatkn/belt/git.js', async (import_original) => {
	const actual = await import_original<typeof import('@ryanatkn/belt/git.js')>();
	return {
		...actual, // Preserves Git_Branch, Git_Origin, and other exports
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

describe('deploy_task build integration', () => {
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

	describe('build task invocation', () => {
		test('invokes build task when build=true', async () => {
			const {existsSync} = await import('node:fs');
			vi.mocked(existsSync).mockReturnValue(true);

			const ctx = create_mock_deploy_task_context({
				build: true,
				dry: true,
			});

			await deploy_task.run(ctx);

			expect(ctx.invoke_task).toHaveBeenCalledWith('build');
		});

		test('skips build task when build=false', async () => {
			const {existsSync} = await import('node:fs');
			vi.mocked(existsSync).mockReturnValue(true);

			const ctx = create_mock_deploy_task_context({
				build: false,
				dry: true,
			});

			await deploy_task.run(ctx);

			expect(ctx.invoke_task).not.toHaveBeenCalled();
		});

		test('build happens after source and target branch preparation', async () => {
			const {git_checkout} = vi.mocked(await import('@ryanatkn/belt/git.js'));
			const {existsSync} = await import('node:fs');
			vi.mocked(existsSync).mockReturnValue(true);

			const ctx = create_mock_deploy_task_context({
				build: true,
				dry: true,
			});

			await deploy_task.run(ctx);

			// git_checkout should be called before invoke_task
			expect(git_checkout).toHaveBeenCalled();
			expect(ctx.invoke_task).toHaveBeenCalled();

			const checkout_order = git_checkout.mock.invocationCallOrder[0]!;
			const build_order = (ctx.invoke_task as any).mock.invocationCallOrder[0]!;

			expect(build_order).toBeGreaterThan(checkout_order);
		});
	});

	describe('build directory validation', () => {
		test('checks that build_dir exists after building', async () => {
			const {existsSync} = await import('node:fs');

			vi.mocked(existsSync).mockReturnValue(true);

			const ctx = create_mock_deploy_task_context({
				build: true,
				build_dir: 'build',
				dry: true,
			});

			await deploy_task.run(ctx);

			// Should check build_dir exists (after multiple other existsSync calls)
			const exists_calls = (existsSync as any).mock.calls;
			const build_check = exists_calls.find((call: any) => call[0] === 'build');
			expect(build_check).toBeDefined();
		});

		test('throws error when build_dir missing', async () => {
			const {existsSync} = await import('node:fs');

			// Everything exists except build_dir
			vi.mocked(existsSync).mockImplementation((path: any) => {
				const path_str = String(path);
				return !path_str.includes('build'); // build dir doesn't exist
			});

			const ctx = create_mock_deploy_task_context({
				build: true,
				build_dir: 'build',
				dry: true,
			});

			// Should throw Task_Error
			await expect(deploy_task.run(ctx)).rejects.toThrow('does not exist after building');
		});

		test('validates custom build_dir path', async () => {
			const {existsSync} = await import('node:fs');

			vi.mocked(existsSync).mockImplementation((path: any) => {
				const path_str = String(path);
				return !path_str.includes('dist'); // custom dist dir doesn't exist
			});

			const ctx = create_mock_deploy_task_context({
				build: true,
				build_dir: 'dist',
				dry: true,
			});

			// Should throw Task_Error mentioning dist
			await expect(deploy_task.run(ctx)).rejects.toThrow(/does not exist after building.*dist/);
		});
	});

	describe('build task failure handling', () => {
		test('catches build error and throws Task_Error', async () => {
			const {existsSync} = await import('node:fs');
			vi.mocked(existsSync).mockReturnValue(true);

			const ctx = create_mock_deploy_task_context({build: true});

			// Mock build task failure
			ctx.invoke_task = vi.fn().mockRejectedValue(new Error('Build failed: TypeScript errors'));

			await expect(deploy_task.run(ctx)).rejects.toThrow(Task_Error);
			await expect(deploy_task.run(ctx)).rejects.toThrow(/Deploy safely canceled/);
		});

		test('logs build failure with git safety message', async () => {
			const {existsSync} = await import('node:fs');
			vi.mocked(existsSync).mockReturnValue(true);

			const ctx = create_mock_deploy_task_context({build: true, dry: false});

			ctx.invoke_task = vi.fn().mockRejectedValue(new Error('Build failed'));

			await expect(deploy_task.run(ctx)).rejects.toThrow();

			// Should log that no git changes were made
			expect(ctx.log.error).toHaveBeenCalledWith(
				expect.stringContaining('build failed'),
				expect.anything(),
				expect.stringContaining('no changes were made to git'),
				expect.anything(),
			);
		});

		test('does not modify git when build fails', async () => {
			const {spawn} = vi.mocked(await import('@ryanatkn/belt/process.js'));
			const {existsSync} = await import('node:fs');
			vi.mocked(existsSync).mockReturnValue(true);

			const ctx = create_mock_deploy_task_context({build: true, dry: false});

			ctx.invoke_task = vi.fn().mockRejectedValue(new Error('Build failed'));

			await expect(deploy_task.run(ctx)).rejects.toThrow();

			// Should NOT have committed or pushed
			expect(spawn).not.toHaveBeenCalledWith(
				'git',
				['commit', '-m', 'deployment'],
				expect.anything(),
			);
			expect(spawn).not.toHaveBeenCalledWith(
				'git',
				expect.arrayContaining(['push']),
				expect.anything(),
			);
		});

		test('shows different message in dry mode when build fails', async () => {
			const {existsSync} = await import('node:fs');
			vi.mocked(existsSync).mockReturnValue(true);

			const ctx = create_mock_deploy_task_context({build: true, dry: true});

			ctx.invoke_task = vi.fn().mockRejectedValue(new Error('Build failed'));

			await expect(deploy_task.run(ctx)).rejects.toThrow();

			// Should log dry deploy failed message
			expect(ctx.log.info).toHaveBeenCalledWith(expect.stringContaining('dry deploy failed'));
		});
	});

	describe('build task success scenarios', () => {
		test('continues to file copying after successful build', async () => {
			const {existsSync, readdirSync} = await import('node:fs');
			const {cp} = await import('node:fs/promises');

			vi.mocked(existsSync).mockReturnValue(true);
			vi.mocked(readdirSync).mockReturnValue(['index.html', 'assets'] as any);

			const ctx = create_mock_deploy_task_context({
				build: true,
				dry: true,
			});

			ctx.invoke_task = vi.fn().mockResolvedValue(undefined);

			await deploy_task.run(ctx);

			// Should copy files after successful build
			expect(cp).toHaveBeenCalled();
		});

		test('creates build_dir before checking if it exists', async () => {
			const {existsSync} = await import('node:fs');

			vi.mocked(existsSync).mockReturnValue(true);

			const ctx = create_mock_deploy_task_context({
				build: true,
				dry: true,
			});

			ctx.invoke_task = vi.fn().mockResolvedValue(undefined);

			await deploy_task.run(ctx);

			// invoke_task should be called before existsSync checks build dir
			expect(ctx.invoke_task).toHaveBeenCalledWith('build');
		});
	});

	describe('build-less deploy', () => {
		test('skips build and uses existing build_dir when no-build=true', async () => {
			const {existsSync} = await import('node:fs');
			const {cp} = await import('node:fs/promises');

			vi.mocked(existsSync).mockReturnValue(true);

			const ctx = create_mock_deploy_task_context({
				build: false,
				dry: true,
			});

			await deploy_task.run(ctx);

			// Should NOT invoke build
			expect(ctx.invoke_task).not.toHaveBeenCalled();

			// Should still check build_dir and copy files
			expect(cp).toHaveBeenCalled();
		});

		test('fails gracefully when build_dir missing and no-build=true', async () => {
			const {existsSync} = await import('node:fs');

			// build_dir doesn't exist, deploy_dir does
			vi.mocked(existsSync).mockImplementation((path: any) => {
				const path_str = String(path);
				return !path_str.includes('build'); // build_dir: false, deploy_dir: true
			});

			const ctx = create_mock_deploy_task_context({
				build: false,
				dry: true,
			});

			// Should throw Task_Error when build_dir doesn't exist
			await expect(deploy_task.run(ctx)).rejects.toThrow('does not exist after building');
		});
	});
});
