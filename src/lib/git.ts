import {spawn, spawn_out} from '@grogarden/util/process.js';
import type {Flavored} from '@grogarden/util/types.js';
import type {SpawnOptions} from 'child_process';
import {z} from 'zod';

// TODO probably extract to `util-git`

export const Git_Origin = z.string();
export type Git_Origin = z.infer<Flavored<typeof Git_Origin, 'Git_Origin'>>;

export const Git_Branch = z.string();
export type Git_Branch = z.infer<Flavored<typeof Git_Branch, 'Git_Branch'>>;

/**
 * Returns the current git branch name or throws if something goes wrong.
 */
export const git_current_branch_name = async (options?: SpawnOptions): Promise<string> => {
	const {stdout} = await spawn_out('git', ['rev-parse', '--abbrev-ref', 'HEAD'], options);
	if (!stdout) throw Error('git_current_branch_name failed');
	const branch_name = stdout.toString().trim();
	return branch_name;
};

/**
 * @returns a boolean indicating if the remote git branch exists
 */
export const git_remote_branch_exists = async (
	origin: Git_Origin,
	branch: Git_Branch,
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
	branch: Git_Branch,
	options?: SpawnOptions,
): Promise<boolean> => {
	const result = await spawn('git', ['show-ref', '--quiet', 'refs/heads/' + branch], options);
	return result.ok;
};

/**
 * TODO make this return an enum and separate the text into a different function
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
	const status_result = await spawn_out('git', ['status', '--porcelain'], options);
	if (status_result.stdout?.length) {
		return 'git has untracked files';
	}
	return null;
};

/**
 * Calls `git fetch` and throws if anything goes wrong.
 */
export const git_fetch = async (
	origin: Git_Origin,
	branch?: Git_Branch,
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
export const git_checkout = async (branch: Git_Branch, options?: SpawnOptions): Promise<void> => {
	const current_branch = await git_current_branch_name(options);
	if (branch === current_branch) {
		return;
	}
	const result = await spawn('git', ['checkout', branch], options);
	if (!result.ok) {
		throw Error(`git_checkout failed for branch ${branch} with code ${result.code}`);
	}
};

/**
 * Calls `git pull` and throws if anything goes wrong.
 */
export const git_pull = async (
	origin: Git_Origin,
	branch?: Git_Branch,
	options?: SpawnOptions,
): Promise<void> => {
	const args = ['pull', origin];
	if (branch) args.push(branch);
	const result = await spawn('git', args, options);
	if (!result.ok) {
		throw Error(`git_pull failed for branch ${branch} with code ${result.code}`);
	}
};

/**
 * Calls `git push` and throws if anything goes wrong.
 */
export const git_push = async (
	origin: Git_Origin,
	branch: Git_Branch,
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
	origin: Git_Origin,
	branch: Git_Branch,
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
	branch: Git_Branch,
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
	origin: Git_Origin,
	branch: Git_Branch,
	options?: SpawnOptions,
): Promise<void> => {
	const result = await spawn('git', ['push', origin, ':' + branch], options);
	if (!result.ok) {
		throw Error(`git_delete_remote_branch failed for branch ${branch} with code ${result.code}`);
	}
};

/**
 * Resets the `target` branch back to its first commit both locally and remotely.
 */
export const git_reset_branch_to_first_commit = async (
	origin: Git_Origin,
	branch: Git_Branch,
	options?: SpawnOptions,
): Promise<void> => {
	await git_checkout(branch, options);
	const first_commit_hash = await git_current_branch_first_commit_hash(options);
	await spawn('git', ['reset', '--hard', first_commit_hash], options);
	await spawn('git', ['push', origin, branch, '--force'], options);
	await git_checkout('-', options);
};

/**
 * Returns the branch's latest commit hash or throws if something goes wrong.
 */
export const git_current_commit_hash = async (
	branch?: string,
	options?: SpawnOptions,
): Promise<string | null> => {
	const final_branch = branch ?? (await git_current_branch_name(options));
	const {stdout} = await spawn_out('git', ['show-ref', '-s', final_branch], options);
	if (!stdout) return null; // TODO hack for CI
	return stdout.toString().split('\n')[0].trim();
};

/**
 * Returns the hash of the current branch's first commit or throws if something goes wrong.
 */
export const git_current_branch_first_commit_hash = async (
	options?: SpawnOptions,
): Promise<string> => {
	const {stdout} = await spawn_out(
		'git',
		['rev-list', '--max-parents=0', '--abbrev-commit', 'HEAD'],
		options,
	);
	if (!stdout) throw Error('git_current_branch_first_commit_hash failed');
	return stdout.toString().trim();
};
