import {readFile, writeFile} from 'fs/promises';
import {z} from 'zod';
import type {Logger} from '@grogarden/util/log.js';

import {github_fetch_commit_prs} from './github.js';

/**
 * Updates a changelog produced by `@changesets/changelog-git` with better links and formatting.
 * It's similar to `@changesets/changelog-github` but doesn't require a token for light usage.
 * This may be better implemented as a standalone dependency
 * as an alternative to `@changesets/changelog-git`.
 * @returns boolean indicating if the changelog changed
 */
export const update_changelog = async (
	owner: string,
	repo: string,
	path = 'CHANGELOG.md',
	token?: string,
	log?: Logger,
	cache: Record<string, any> = {}, // include a default cache to efficiently handle multiple changesets per commit
): Promise<boolean> => {
	console.log(`path`, path);
	const contents = await readFile(path, 'utf8');
	console.log(`contents`, contents.length);
	const parsed = parse_changelog(contents);
	console.log(`parsed`, parsed);
	const mapped = await map_changelog(parsed, owner, repo, token, log, cache);
	console.log(`mapped`, mapped);
	const updated = serialize_changelog(mapped);
	console.log(`updated`, updated);
	if (contents === updated) {
		return false;
	}
	await writeFile(path, updated, 'utf8');
	return true;
};

// keeping this really simple for now, no need to parse further for our current usecases
const Parsed_Changelog = z.array(z.string());
type Parsed_Changelog = z.infer<typeof Parsed_Changelog>;
const parse_changelog = (contents: string): Parsed_Changelog => contents.split('\n');
const serialize_changelog = (parsed: Parsed_Changelog): string => parsed.join('\n');

const LINE_WITH_SHA_MATCHER = /^- ([a-z0-9]{7,8}): /u;

const map_changelog = async (
	parsed: Parsed_Changelog,
	owner: string,
	repo: string,
	token?: string,
	log?: Logger,
	cache?: Record<string, any>,
): Promise<Parsed_Changelog> => {
	const mapped: Parsed_Changelog = [];
	for (const line of parsed) {
		const matches = LINE_WITH_SHA_MATCHER.exec(line);
		if (matches) {
			const commit_sha = matches[1];
			console.log(`MATCHED line`, commit_sha, line);
			const prs = await github_fetch_commit_prs(owner, repo, commit_sha, token, log, cache); // eslint-disable-line no-await-in-loop
			console.log(`prs`, prs);
			// TODO BLOCK if prs, link to it, otherwise link directly to the commit, at the end in parens in both cases
		} else {
			mapped.push(line);
		}
	}
	return mapped;
};
