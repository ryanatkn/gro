import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest';

import {task as deploy_task} from '../lib/deploy.task.ts';

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

describe('deploy_task error handling', () => {
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

	describe('git operation failures', () => {
		test('propagates git_check_clean_workspace errors', async () => {
			const {git_check_clean_workspace} = vi.mocked(await import('@ryanatkn/belt/git.js'));

			vi.mocked(git_check_clean_workspace).mockRejectedValue(new Error('Git not installed'));

			const ctx = create_mock_deploy_task_context();

			await expect(deploy_task.run(ctx)).rejects.toThrow('Git not installed');
		});

		test('propagates git_check_setting_pull_rebase errors', async () => {
			const {git_check_setting_pull_rebase} = vi.mocked(await import('@ryanatkn/belt/git.js'));

			vi.mocked(git_check_setting_pull_rebase).mockRejectedValue(
				new Error('Failed to read git config'),
			);

			const ctx = create_mock_deploy_task_context();

			await expect(deploy_task.run(ctx)).rejects.toThrow('Failed to read git config');
		});

		test('propagates git_local_branch_exists errors', async () => {
			const {git_local_branch_exists} = vi.mocked(await import('@ryanatkn/belt/git.js'));

			vi.mocked(git_local_branch_exists).mockRejectedValue(new Error('Git command failed'));

			const ctx = create_mock_deploy_task_context();

			await expect(deploy_task.run(ctx)).rejects.toThrow('Git command failed');
		});

		test('propagates git_fetch errors', async () => {
			const {git_local_branch_exists, git_fetch} = vi.mocked(await import('@ryanatkn/belt/git.js'));

			vi.mocked(git_local_branch_exists).mockResolvedValue(false); // trigger fetch
			vi.mocked(git_fetch).mockRejectedValue(new Error('Network error'));

			const ctx = create_mock_deploy_task_context();

			await expect(deploy_task.run(ctx)).rejects.toThrow('Network error');
		});

		test('propagates git_checkout errors', async () => {
			const {git_checkout} = vi.mocked(await import('@ryanatkn/belt/git.js'));

			vi.mocked(git_checkout).mockRejectedValue(new Error('Branch not found'));

			const ctx = create_mock_deploy_task_context();

			await expect(deploy_task.run(ctx)).rejects.toThrow('Branch not found');
		});

		test('propagates git_pull errors', async () => {
			const {git_pull} = vi.mocked(await import('@ryanatkn/belt/git.js'));

			vi.mocked(git_pull).mockRejectedValue(new Error('Pull failed: merge conflicts'));

			const ctx = create_mock_deploy_task_context();

			await expect(deploy_task.run(ctx)).rejects.toThrow('Pull failed: merge conflicts');
		});

		test('propagates git_remote_branch_exists errors', async () => {
			const {git_remote_branch_exists} = vi.mocked(await import('@ryanatkn/belt/git.js'));

			vi.mocked(git_remote_branch_exists).mockRejectedValue(new Error('Remote not found'));

			const ctx = create_mock_deploy_task_context();

			await expect(deploy_task.run(ctx)).rejects.toThrow('Remote not found');
		});

		test('propagates git_clone_locally errors', async () => {
			const {git_remote_branch_exists, git_clone_locally} = vi.mocked(
				await import('@ryanatkn/belt/git.js'),
			);
			const {existsSync} = await import('node:fs');

			vi.mocked(git_remote_branch_exists).mockResolvedValue(false); // trigger new branch path
			vi.mocked(existsSync).mockReturnValue(false);
			vi.mocked(git_clone_locally).mockRejectedValue(new Error('Clone failed'));

			const ctx = create_mock_deploy_task_context({dry: true});

			await expect(deploy_task.run(ctx)).rejects.toThrow('Clone failed');
		});

		test('propagates git_current_branch_name errors', async () => {
			const {git_current_branch_name} = vi.mocked(await import('@ryanatkn/belt/git.js'));
			const {existsSync} = await import('node:fs');

			vi.mocked(existsSync).mockReturnValue(true); // deploy dir exists
			vi.mocked(git_current_branch_name).mockRejectedValue(new Error('Not a git repository'));

			const ctx = create_mock_deploy_task_context({dry: true});

			await expect(deploy_task.run(ctx)).rejects.toThrow('Not a git repository');
		});

		test('propagates git_delete_local_branch errors', async () => {
			const {
				git_local_branch_exists,
				git_delete_local_branch,
				git_remote_branch_exists,
			} = vi.mocked(await import('@ryanatkn/belt/git.js'));
			const {existsSync} = await import('node:fs');

			// Trigger local branch deletion (line 182 - deploy_dir doesn't exist, remote exists, local branch doesn't exist before fetch)
			vi.mocked(existsSync).mockImplementation((path: any) => {
				const path_str = String(path);
				if (path_str.includes('build')) return true; // build_dir exists
				return false; // deploy_dir doesn't exist
			});
			vi.mocked(git_remote_branch_exists).mockResolvedValue(true); // remote exists
			vi.mocked(git_local_branch_exists).mockResolvedValue(false); // local branch doesn't exist (before fetch), so we need to clean up after clone
			vi.mocked(git_delete_local_branch).mockRejectedValue(
				new Error('Cannot delete checked out branch'),
			);

			const ctx = create_mock_deploy_task_context({dry: true});

			await expect(deploy_task.run(ctx)).rejects.toThrow('Cannot delete checked out branch');
		});

		test('propagates git_reset_branch_to_first_commit errors', async () => {
			const {git_reset_branch_to_first_commit} = vi.mocked(await import('@ryanatkn/belt/git.js'));
			const {existsSync} = await import('node:fs');

			vi.mocked(existsSync).mockReturnValue(true);
			vi.mocked(git_reset_branch_to_first_commit).mockRejectedValue(new Error('Reset failed'));

			const ctx = create_mock_deploy_task_context({
				reset: true,
				dry: true,
			});

			await expect(deploy_task.run(ctx)).rejects.toThrow('Reset failed');
		});
	});

	describe('filesystem operation failures', () => {
		test('propagates existsSync errors', async () => {
			const {existsSync} = await import('node:fs');

			vi.mocked(existsSync).mockImplementation(() => {
				throw new Error('Permission denied');
			});

			const ctx = create_mock_deploy_task_context({dry: true});

			await expect(deploy_task.run(ctx)).rejects.toThrow('Permission denied');
		});

		test('propagates rm errors', async () => {
			const {git_remote_branch_exists} = vi.mocked(await import('@ryanatkn/belt/git.js'));
			const {rm} = await import('node:fs/promises');
			const {existsSync} = await import('node:fs');

			vi.mocked(git_remote_branch_exists).mockResolvedValue(false); // trigger deletion
			vi.mocked(existsSync).mockReturnValue(true); // deploy dir exists
			vi.mocked(rm).mockRejectedValue(new Error('Cannot remove directory'));

			const ctx = create_mock_deploy_task_context({dry: true});

			await expect(deploy_task.run(ctx)).rejects.toThrow('Cannot remove directory');
		});

		test('propagates mkdir errors', async () => {
			const {git_remote_branch_exists} = vi.mocked(await import('@ryanatkn/belt/git.js'));
			const {mkdir} = await import('node:fs/promises');
			const {existsSync} = await import('node:fs');

			vi.mocked(git_remote_branch_exists).mockResolvedValue(false);
			vi.mocked(existsSync).mockReturnValue(true);
			vi.mocked(mkdir).mockRejectedValue(new Error('Disk full'));

			const ctx = create_mock_deploy_task_context({dry: true});

			await expect(deploy_task.run(ctx)).rejects.toThrow('Disk full');
		});

		test('propagates empty_dir errors', async () => {
			const {empty_dir} = vi.mocked(await import('../lib/fs.ts'));
			const {existsSync} = await import('node:fs');

			vi.mocked(existsSync).mockReturnValue(true);
			vi.mocked(empty_dir).mockRejectedValue(new Error('Failed to empty directory'));

			const ctx = create_mock_deploy_task_context({dry: true});

			await expect(deploy_task.run(ctx)).rejects.toThrow('Failed to empty directory');
		});

		test('propagates readdirSync errors', async () => {
			const {readdirSync} = await import('node:fs');
			const {existsSync} = await import('node:fs');

			vi.mocked(existsSync).mockReturnValue(true);
			vi.mocked(readdirSync).mockImplementation(() => {
				throw new Error('Cannot read directory');
			});

			const ctx = create_mock_deploy_task_context({dry: true});

			await expect(deploy_task.run(ctx)).rejects.toThrow('Cannot read directory');
		});

		test('propagates cp errors', async () => {
			const {cp} = await import('node:fs/promises');
			const {existsSync} = await import('node:fs');

			vi.mocked(existsSync).mockReturnValue(true);
			vi.mocked(cp).mockRejectedValue(new Error('Failed to copy files'));

			const ctx = create_mock_deploy_task_context({dry: true});

			await expect(deploy_task.run(ctx)).rejects.toThrow('Failed to copy files');
		});
	});

	describe('spawn operation failures', () => {
		test('propagates spawn errors for git reset', async () => {
			const {spawn} = vi.mocked(await import('@ryanatkn/belt/process.js'));
			const {existsSync} = await import('node:fs');

			vi.mocked(existsSync).mockReturnValue(true);

			// Make git reset fail
			vi.mocked(spawn).mockImplementation(async (cmd, args) => {
				if (cmd === 'git' && args?.[0] === 'reset') {
					throw new Error('Git reset failed');
				}
				return {code: 0} as any;
			});

			const ctx = create_mock_deploy_task_context({dry: true});

			await expect(deploy_task.run(ctx)).rejects.toThrow('Git reset failed');
		});

		test('propagates spawn errors for orphan branch creation', async () => {
			const {git_remote_branch_exists} = vi.mocked(await import('@ryanatkn/belt/git.js'));
			const {spawn} = vi.mocked(await import('@ryanatkn/belt/process.js'));
			const {existsSync} = await import('node:fs');

			vi.mocked(git_remote_branch_exists).mockResolvedValue(false); // trigger new branch
			vi.mocked(existsSync).mockReturnValue(false);

			// Make checkout --orphan fail
			vi.mocked(spawn).mockImplementation(async (cmd, args) => {
				if (cmd === 'git' && args?.[0] === 'checkout' && args[1] === '--orphan') {
					throw new Error('Failed to create orphan branch');
				}
				return {code: 0} as any;
			});

			const ctx = create_mock_deploy_task_context({dry: true});

			await expect(deploy_task.run(ctx)).rejects.toThrow('Failed to create orphan branch');
		});

		test('propagates spawn errors for git add in commit phase', async () => {
			const {spawn} = vi.mocked(await import('@ryanatkn/belt/process.js'));
			const {existsSync} = await import('node:fs');

			vi.mocked(existsSync).mockImplementation((path: any) => {
				const path_str = String(path);
				return path_str.includes('build') || path_str.includes('.gro/deploy'); // both exist
			});

			// Make git add fail in commit phase (line 258, not orphan setup)
			vi.mocked(spawn).mockImplementation(async (cmd, args, options) => {
				if (cmd === 'git' && args?.[0] === 'add' && args[1] === '.') {
					// This is the commit phase add (line 258), not orphan setup add (line 211)
					throw new Error('Add failed');
				}
				return {code: 0} as any;
			});

			const ctx = create_mock_deploy_task_context({dry: false});

			await expect(deploy_task.run(ctx)).rejects.toThrow();
		});
	});

	describe('build task failures', () => {
		test('propagates build task errors', async () => {
			const {existsSync} = await import('node:fs');
			vi.mocked(existsSync).mockReturnValue(true);

			const ctx = create_mock_deploy_task_context({build: true});

			ctx.invoke_task = vi.fn().mockRejectedValue(new Error('TypeScript compilation failed'));

			await expect(deploy_task.run(ctx)).rejects.toThrow(/Deploy safely canceled/);
		});

		test('does not make git changes when build fails', async () => {
			const {spawn} = vi.mocked(await import('@ryanatkn/belt/process.js'));
			const {existsSync} = await import('node:fs');
			vi.mocked(existsSync).mockReturnValue(true);

			const ctx = create_mock_deploy_task_context({build: true, dry: false});

			ctx.invoke_task = vi.fn().mockRejectedValue(new Error('Build error'));

			await expect(deploy_task.run(ctx)).rejects.toThrow();

			// Should NOT have tried to commit or push
			const git_commits = spawn.mock.calls.filter(
				(call) => call[0] === 'git' && call[1]?.[0] === 'commit',
			);
			expect(git_commits.length).toBe(0);
		});
	});

	describe('error message clarity', () => {
		test('safety check errors include helpful context', async () => {
			const ctx = create_mock_deploy_task_context({
				target: 'custom',
				force: false,
			});

			await expect(deploy_task.run(ctx)).rejects.toThrow(/--force/);
		});

		test('dirty workspace error includes git status output', async () => {
			const {git_check_clean_workspace} = vi.mocked(await import('@ryanatkn/belt/git.js'));

			vi.mocked(git_check_clean_workspace).mockResolvedValue(
				'Modified files:\n  src/foo.ts\n  src/bar.ts',
			);

			const ctx = create_mock_deploy_task_context();

			try {
				await deploy_task.run(ctx);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.message).toContain('uncommitted changes');
			}
		});

		test('git operation errors in bad state include actionable message', async () => {
			const {spawn} = vi.mocked(await import('@ryanatkn/belt/process.js'));
			const {existsSync} = await import('node:fs');
			vi.mocked(existsSync).mockReturnValue(true);

			// Fail during push
			vi.mocked(spawn).mockImplementation(async (cmd, args) => {
				if (cmd === 'git' && args?.[0] === 'push') {
					throw new Error('Network timeout');
				}
				return {code: 0} as any;
			});

			const ctx = create_mock_deploy_task_context({dry: false});

			try {
				await deploy_task.run(ctx);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.message).toContain('bad state');
				expect(err.message).toContain('built but not pushed');
			}
		});
	});
});
