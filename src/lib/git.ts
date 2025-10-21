import {spawn_out} from '@ryanatkn/belt/process.js';

/**
 * Gets the current git commit hash (full SHA).
 * @returns The current HEAD commit hash, or null if not in a git repository or git fails
 */
export const git_current_commit_hash = async (): Promise<string | null> => {
	const {result, stdout} = await spawn_out('git', ['rev-parse', 'HEAD']);
	if (!result.ok || !stdout) {
		return null;
	}
	return stdout.trim();
};
