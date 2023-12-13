// TODO if this grows at all, use `@octokit/request`,
// for now it's just calling a single endpoint so we do it manually
// and we specify just the types we need

import type {Logger} from '@grogarden/util/log.js';
import {z} from 'zod';

export const Github_Pull_Request = z.object({
	url: z.string(),
	id: z.number(),
	html_url: z.string(),
	number: z.number(),
	user: z.object({
		login: z.string(),
	}),
});
export type Github_Pull_Request = z.infer<typeof Github_Pull_Request>;

/**
 *@see https://docs.github.com/en/rest/commits/commits?apiVersion=2022-11-28#list-pull-requests-associated-with-a-commit
 */
export const github_fetch_commit_prs = async (
	owner: string,
	repo: string,
	commit_sha: string,
	token?: string,
	log?: Logger,
	cache?: Record<string, any>,
): Promise<Github_Pull_Request[]> => {
	const url = `https://api.github.com/repos/${owner}/${repo}/commits/${commit_sha}/pulls`;
	if (cache) {
		const cached = cache[url];
		if (cached) {
			log?.debug('[github_fetch_commit_prs] cached', cached.length);
			return cached.map((p: unknown) => Github_Pull_Request.parse(p));
		}
	}

	log?.info('[github_fetch_commit_prs] fetching GitHub PR info', url);

	const headers: Record<string, string> = {accept: 'application/vnd.github+json'};
	if (token) {
		headers.bearer = token;
	}
	const res = await fetch(url, {headers});
	log?.info(`[github_fetch_commit_prs] res.headers`, Object.fromEntries(res.headers.entries()));

	const json = await res.json();
	log?.debug(`[github_fetch_commit_prs] fetched json`, JSON.stringify(json));

	return json.map((p: unknown) => Github_Pull_Request.parse(p));
};
