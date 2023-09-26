import {spawn} from '@grogarden/util/process.js';
import type {SpawnOptions} from 'child_process';

import {paths} from './paths.js';

/**
 * @returns a boolean indicating if the remote git branch exists
 */
export const git_remote_branch_exists = async (
	origin: string,
	branch: string,
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
	branch: string,
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
	origin: string,
	branch?: string,
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
export const git_checkout = async (branch: string, options?: SpawnOptions): Promise<void> => {
	const result = await spawn('git', ['checkout', branch], options);
	if (!result.ok) {
		throw Error(`git_checkout failed for branch ${branch} with code ${result.code}`);
	}
};

export const WORKTREE_DIRNAME = 'worktree';
export const WORKTREE_DIR = `${paths.root}${WORKTREE_DIRNAME}`;

/**
 * Removes the specified git worktree and then prunes.
 */
export const clean_git_worktree = async (
	worktree_dirname = WORKTREE_DIRNAME,
	options: SpawnOptions = {stdio: 'pipe'}, // silence the output by default
): Promise<void> => {
	await spawn('git', ['worktree', 'remove', worktree_dirname, '--force'], options);
	await spawn('git', ['worktree', 'prune'], options);
};
