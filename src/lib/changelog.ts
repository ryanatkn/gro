import {readFile} from 'fs/promises';

/**
 * Updates a changelog produced by `@changesets/changelog-git` with better links and formatting.
 * This may be better implemented as a standalone dependency
 * as an alternative to `@changesets/changelog-git`.
 * @returns boolean indicating if the changelog changed
 */
export const update_changelog = async (path = 'CHANGELOG.md'): Promise<boolean> => {
	const contents = await readFile(path, 'utf8');
	console.log(`contents`, contents);
	return true;
};
