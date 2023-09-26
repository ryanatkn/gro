import {spawn} from '@grogarden/util/process.js';

export const remote_branch_exists = async (origin: string, branch: string): Promise<boolean> => {
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
			`remote_branch_exists failed for ${branch} and origin ${origin} with code ${result.code}`,
		);
	}
};
