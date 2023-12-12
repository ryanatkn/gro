import {readFile, writeFile} from 'fs/promises';

/**
 * Updates a changelog produced by `@changesets/changelog-git` with better links and formatting.
 * This may be better implemented as a standalone dependency
 * as an alternative to `@changesets/changelog-git`.
 * @returns boolean indicating if the changelog changed
 */
export const update_changelog = async (path = 'CHANGELOG.md'): Promise<boolean> => {
	const contents = await readFile(path, 'utf8');
	const parsed = parse_changelog(contents);
	console.log(`parsed`, parsed);
	// const mapped = map_changelog(parsed);
	// const updated = serialize_changelog(mapped);
	// await writeFile(path, updated, 'utf8');
	return true;
};

const parse_changelog = (contents: string) => {
	//
	const lines = contents.split('\n');
	console.log(`lines`, lines);
};
