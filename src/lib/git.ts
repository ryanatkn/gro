import {spawn, spawn_out} from '@ryanatkn/util/process.js';
import type {Flavored} from '@ryanatkn/util/types.js';
import type {SpawnOptions} from 'child_process';
import {z} from 'zod';

import {exists} from './fs.js';
import {to_file_path} from './path.js';

// TODO maybe extract to `util-git`

export const Git_Origin = z.string();
export type Git_Origin = Flavored<z.infer<typeof Git_Origin>, 'Git_Origin'>;

export const Git_Branch = z.string();
export type Git_Branch = Flavored<z.infer<typeof Git_Branch>, 'Git_Branch'>;

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
	origin: Git_Origin = 'origin',
	branch?: Git_Branch,
	options?: SpawnOptions,
): Promise<boolean> => {
	const final_branch = branch ?? (await git_current_branch_name(options));
	if (options?.cwd && !(await exists(to_file_path(options.cwd)))) {
		return false;
	}
	const result = await spawn(
		'git',
		['ls-remote', '--exit-code', '--heads', origin, 'refs/heads/' + final_branch],
		options,
	);
	if (result.ok) {
		return true;
	} else if (result.code === 2) {
		return false;
	} else {
		throw Error(
			`git_remote_branch_exists failed for origin '${origin}' and branch '${final_branch}' with code ${result.code}`,
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
	if (options?.cwd && !(await exists(to_file_path(options.cwd)))) {
		return false;
	}
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
	origin: Git_Origin = 'origin',
	branch?: Git_Branch,
	options?: SpawnOptions,
): Promise<void> => {
	const args = ['fetch', origin];
	if (branch) args.push(branch);
	const result = await spawn('git', args, options);
	if (!result.ok) {
		throw Error(
			`git_fetch failed for origin '${origin}' and branch '${branch}' with code ${result.code}`,
		);
	}
};

/**
 * Calls `git checkout` and throws if anything goes wrong.
 * @returns the previous branch name, if it changed
 */
export const git_checkout = async (
	branch: Git_Branch,
	options?: SpawnOptions,
): Promise<Git_Branch | null> => {
	const current_branch = await git_current_branch_name(options);
	if (branch === current_branch) {
		return null;
	}
	const result = await spawn('git', ['checkout', branch], options);
	if (!result.ok) {
		throw Error(`git_checkout failed for branch '${branch}' with code ${result.code}`);
	}
	return current_branch;
};

/**
 * Calls `git pull` and throws if anything goes wrong.
 */
export const git_pull = async (
	origin: Git_Origin = 'origin',
	branch?: Git_Branch,
	options?: SpawnOptions,
): Promise<void> => {
	const args = ['pull', origin];
	if (branch) args.push(branch);
	const result = await spawn('git', args, options);
	if (!result.ok) {
		throw Error(`git_pull failed for branch '${branch}' with code ${result.code}`);
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
	const final_branch = branch ?? (await git_current_branch_name(options));
	const result = await spawn('git', ['push', origin, final_branch], options);
	if (!result.ok) {
		throw Error(`git_push failed for branch '${final_branch}' with code ${result.code}`);
	}
};

/**
 * Calls `git push` and throws if anything goes wrong.
 */
export const git_push_to_create = async (
	origin: Git_Origin = 'origin',
	branch?: Git_Branch,
	options?: SpawnOptions,
): Promise<void> => {
	const final_branch = branch ?? (await git_current_branch_name(options));
	const push_args = ['push'];
	if (await git_remote_branch_exists(origin, final_branch, options)) {
		push_args.push(origin);
	} else {
		push_args.push('-u', origin);
	}
	push_args.push(final_branch);
	const result = await spawn('git', push_args, options);
	if (!result.ok) {
		throw Error(`git_push failed for branch '${final_branch}' with code ${result.code}`);
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
		throw Error(`git_delete_local_branch failed for branch '${branch}' with code ${result.code}`);
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
		throw Error(`git_delete_remote_branch failed for branch '${branch}' with code ${result.code}`);
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
	const previous_branch = await git_checkout(branch, options);
	const first_commit_hash = await git_current_branch_first_commit_hash(options);
	await spawn('git', ['reset', '--hard', first_commit_hash], options);
	await spawn('git', ['push', origin, branch, '--force'], options);
	if (previous_branch) {
		await git_checkout(previous_branch, options);
	}
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

/**
 * Returns the global git config setting for `pull.rebase`.
 * Gro is currently written to expect `true`,
 * but the restriction could be loosened with additional work.
 */
export const git_check_setting_pull_rebase = async (options?: SpawnOptions): Promise<boolean> => {
	const value = await spawn_out('git', ['config', '--global', 'pull.rebase'], options);
	return value.stdout?.trim() === 'true';
};

/**
 * Clones a branch locally to another directory and updates the origin to match the source.
 */
export const git_clone_locally = async (
	origin: Git_Origin,
	branch: Git_Branch,
	source_dir: string,
	target_dir: string,
	options?: SpawnOptions,
): Promise<void> => {
	await spawn('git', ['clone', '-b', branch, '--single-branch', source_dir, target_dir], options);
	const origin_url = (
		await spawn_out('git', ['remote', 'get-url', origin], {...options, cwd: source_dir})
	).stdout?.trim();
	if (!origin_url) throw Error('Failed to get the origin url with git in ' + source_dir);
	await spawn('git', ['remote', 'set-url', origin, origin_url], {...options, cwd: target_dir});
};
