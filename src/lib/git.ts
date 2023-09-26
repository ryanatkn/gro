import {spawn} from '@grogarden/util/process.js';
import type {Flavored} from '@grogarden/util/types.js';
import {execSync, type SpawnOptions} from 'child_process';
import {z} from 'zod';

import {paths} from './paths.js';

export const GitOrigin = z.string();
export type GitOrigin = z.infer<Flavored<typeof GitOrigin, 'GitOrigin'>>;

export const GitBranch = z.string();
export type GitBranch = z.infer<Flavored<typeof GitBranch, 'GitBranch'>>;

/**
 * @returns a boolean indicating if the remote git branch exists
 */
export const git_remote_branch_exists = async (
	origin: GitOrigin,
	branch: GitBranch,
	options?: SpawnOptions,
): Promise<boolean> => {
	const result = await spawn(
		'git',
		['ls-remote', '--exit-code', '--heads', origin, 'refs/heads/' + branch],
		options,
	);
	if (result.ok) {
		return true;
	} else if (result.code === 2) {
		return false;
	} else {
		throw Error(
			`git_remote_branch_exists failed for origin ${origin} and branch ${branch} with code ${result.code}`,
		);
	}
};

/**
 * @returns a boolean indicating if the local git branch exists
 */
export const git_local_branch_exists = async (
	branch: GitBranch,
	options?: SpawnOptions,
): Promise<boolean> => {
	const result = await spawn('git', ['show-ref', '--quiet', 'refs/heads/' + branch], options);
	return result.ok;
};

/**
 * @returns an error message if the git workspace has any unstaged or uncommitted changes, or `null` if it's clean
 */
export const git_check_clean_workspace = async (options?: SpawnOptions): Promise<string | null> => {
	const unstaged_result = await spawn('git', ['diff', '--exit-code', '--quiet'], options);
	if (!unstaged_result.ok) {
		return 'git has unstaged changes';
	}
	const staged_result = await spawn('git', ['diff', '--exit-code', '--cached', '--quiet'], options);
	if (!staged_result.ok) {
		return 'git has staged but uncommitted changes';
	}
	return null;
};

/**
 * Calls `git fetch` and throws if anything goes wrong.
 */
export const git_fetch = async (
	origin: GitOrigin,
	branch?: GitBranch,
	options?: SpawnOptions,
): Promise<void> => {
	const args = ['fetch', origin];
	if (branch) args.push(branch);
	const result = await spawn('git', args, options);
	if (!result.ok) {
		throw Error(
			`git_fetch failed for origin ${origin} and branch ${branch} with code ${result.code}`,
		);
	}
};

/**
 * Calls `git checkout` and throws if anything goes wrong.
 */
export const git_checkout = async (branch: GitBranch, options?: SpawnOptions): Promise<void> => {
	const result = await spawn('git', ['checkout', branch], options);
	if (!result.ok) {
		throw Error(`git_checkout failed for branch ${branch} with code ${result.code}`);
	}
};

/**
 * Calls `git pull` and throws if anything goes wrong.
 */
export const git_pull = async (
	origin: GitOrigin,
	branch: GitBranch,
	options?: SpawnOptions,
): Promise<void> => {
	const result = await spawn('git', ['pull', origin, branch], options);
	if (!result.ok) {
		throw Error(`git_pull failed for branch ${branch} with code ${result.code}`);
	}
};

/**
 * Calls `git push` and throws if anything goes wrong.
 */
export const git_push = async (
	origin: GitOrigin,
	branch: GitBranch,
	options?: SpawnOptions,
): Promise<void> => {
	const result = await spawn('git', ['push', origin, branch], options);
	if (!result.ok) {
		throw Error(`git_push failed for branch ${branch} with code ${result.code}`);
	}
};

/**
 * Calls `git push` and throws if anything goes wrong.
 */
export const git_push_to_create = async (
	origin: GitOrigin,
	branch: GitBranch,
	options?: SpawnOptions,
): Promise<void> => {
	const result = await spawn('git', ['push', '-u', origin, branch], options);
	if (!result.ok) {
		throw Error(`git_push failed for branch ${branch} with code ${result.code}`);
	}
};

/**
 * Deletes a branch locally and throws if anything goes wrong.
 */
export const git_delete_local_branch = async (
	branch: GitBranch,
	options?: SpawnOptions,
): Promise<void> => {
	const result = await spawn('git', ['branch', '-D', branch], options);
	if (!result.ok) {
		throw Error(`git_delete_local_branch failed for branch ${branch} with code ${result.code}`);
	}
};

/**
 * Deletes a branch remotely and throws if anything goes wrong.
 */
export const git_delete_remote_branch = async (
	origin: GitOrigin,
	branch: GitBranch,
	options?: SpawnOptions,
): Promise<void> => {
	const result = await spawn('git', ['push', origin, ':' + branch], options);
	if (!result.ok) {
		throw Error(`git_delete_remote_branch failed for branch ${branch} with code ${result.code}`);
	}
};

export const WORKTREE_DIRNAME = 'worktree';
export const WORKTREE_DIR = `${paths.root}${WORKTREE_DIRNAME}`;

/**
 * Removes the specified git worktree and then prunes.
 */
export const git_clean_worktree = async (
	worktree_dirname = WORKTREE_DIRNAME,
	options: SpawnOptions = {stdio: 'pipe'}, // silence the output by default
): Promise<void> => {
	await spawn('git', ['worktree', 'remove', worktree_dirname, '--force'], options);
	await spawn('git', ['worktree', 'prune'], options);
};

/**
 * Resets the `target` branch back to its first commit both locally and remotely.
 */
export const git_reset_branch_to_first_commit = async (
	origin: GitOrigin,
	branch: GitBranch,
): Promise<void> => {
	console.log(`branch`, branch);
	await git_checkout(branch);
	// TODO use `spawn` instead of `execSync`
	const first_commit_hash = execSync(
		'git rev-list --max-parents=0 --abbrev-commit HEAD',
	).toString();
	console.log(`first_commit_hash`, first_commit_hash);
	await spawn('git', ['reset', '--hard', first_commit_hash]);
	console.log('reset to first commit');
	await spawn('git', ['push', origin, branch, '--force']);
	console.log('DONE');
	await git_checkout('-');
};
