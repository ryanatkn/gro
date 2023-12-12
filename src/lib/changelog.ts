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

const SECTION_MATCHER = /^## (\d+\.\d+\.\d+)$/u;
const SUBSECTION_MATCHER = /^### (.+)$/u;

export const parse_changelog = (contents: string): Parsed_Changelog => {
	const parsed: Parsed_Changelog = {sections: []};
	const lines = contents.split('\n');
	let section = '';
	let subsection = '';
	for (const line of lines) {
		const section_matches = SECTION_MATCHER.exec(line);
		if (section_matches) {
			section = section_matches[1];
			console.log(`section`, section);
			continue;
		}
		const subsection_matches = SUBSECTION_MATCHER.exec(line);
		if (subsection_matches) {
			subsection = subsection_matches[1];
			console.log(`subsection`, subsection);
			continue;
		}
	}
	console.log(`lines`, lines);

	return parsed;
};

export const serialize_changelog = (parsed: Parsed_Changelog): string => {
	let serialized = '';
	for (const section of parsed.sections) {
		console.log(`serialize section`, section);
	}
	return serialized;
};

const LINE_WITH_SHA_MATCHER = /^- ([a-z0-9]{7,8}): /u;

export const map_changelog = async (
	parsed: Parsed_Changelog,
	owner: string,
	repo: string,
): Promise<Parsed_Changelog> => {
	const mapped: Parsed_Changelog = {sections: []};
	for (const section of parsed.sections) {
		for (const line of section.lines) {
			const matches = LINE_WITH_SHA_MATCHER.exec(line);
			if (matches) {
				const commit_sha = matches[1];
				console.log(`MATCHED line`, commit_sha, line);
				const prs = await github_fetch_commit_prs(owner, repo, commit_sha); // eslint-disable-line no-await-in-loop
				console.log(`prs`, prs);
			}
		}
	}
	process.exit();
	return mapped;
};
