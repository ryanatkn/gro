import {readFile, writeFile} from 'fs/promises';
import {z} from 'zod';

import {github_fetch_commit_prs} from './github.js';

export const Parsed_Changelog = z.object({
	sections: z.array(
		z.object({
			lines: z.array(z.string()),
		}),
	),
});
export type Parsed_Changelog = z.infer<typeof Parsed_Changelog>;

/**
 * Updates a changelog produced by `@changesets/changelog-git` with better links and formatting.
 * This may be better implemented as a standalone dependency
 * as an alternative to `@changesets/changelog-git`.
 * @returns boolean indicating if the changelog changed
 */
export const update_changelog = async (
	owner: string,
	repo: string,
	path = 'CHANGELOG.md',
): Promise<boolean> => {
	const contents = await readFile(path, 'utf8');
	console.log(`contents`, contents.length);
	const parsed = parse_changelog(contents);
	console.log(`parsed`, parsed);
	const mapped = await map_changelog(parsed, owner, repo);
	console.log(`mapped`, mapped);
	const updated = serialize_changelog(mapped);
	console.log(`updated`, updated);
	if (contents === updated) {
		return false;
	}
	await writeFile(path, updated, 'utf8');
	return true;
};

export const parse_changelog = (contents: string): Parsed_Changelog => {
	const parsed: Parsed_Changelog = {sections: []};
	//
	const lines = contents.split('\n');
	console.log(`lines`, lines);

	return parsed;
};

export const serialize_changelog = (parsed: Parsed_Changelog): string => {
	let serialized = '';
	for (const section of parsed.sections) {
		console.log(`section`, section);
	}
	return serialized;
};

export const map_changelog = async (
	parsed: Parsed_Changelog,
	owner: string,
	repo: string,
): Promise<Parsed_Changelog> => {
	const mapped: Parsed_Changelog = {sections: []};
	for (const section of parsed.sections) {
		const prs = await github_fetch_commit_prs(owner, repo, commit_sha); // eslint-disable-line no-await-in-loop
		console.log(`prs`, prs);
	}
	console.log(`prs`, prs);
	process.exit();
	return mapped;
};
