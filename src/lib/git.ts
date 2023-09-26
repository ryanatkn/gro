import {spawn} from '@grogarden/util/process.js';

export const git_remote_branch_exists = async (
	origin: string,
	branch: string,
): Promise<boolean> => {
	const result = await spawn('git', [
		'ls-remote',
		'--exit-code',
		'--heads',
		origin,
		'refs/heads/' + branch,
	]);
	if (result.ok) {
		return true;
	} else if (result.code === 2) {
		return false;
	} else {
		throw Error(
			`git_remote_branch_exists failed for ${branch}` +
				` and origin ${origin} with code ${result.code}`,
		);
	}
};

/**
 * @returns an error message if the git workspace has any unstaged or uncommitted changes
 */
export const git_check_clean_workspace = async (): Promise<string | null> => {
	const unstaged_result = await spawn('git', ['diff', '--exit-code', '--quiet']);
	if (!unstaged_result.ok) {
		return 'git has unstaged changes';
	}
	const staged_result = await spawn('git', ['diff', '--exit-code', '--cached', '--quiet']);
	if (!staged_result.ok) {
		return 'git has staged but uncommitted changes';
	}
	return null;
};
