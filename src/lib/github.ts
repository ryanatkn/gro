// TODO if this grows at all, use `@octokit/request`,
// for now it's just calling a single endpoint so we do it manually
// and we specify just the types we need

import {Fetch_Value_Cache, fetch_value} from '@ryanatkn/belt/fetch.js';
import type {Logger} from '@ryanatkn/belt/log.js';
import {z} from 'zod';

export const GITHUB_REPO_MATCHER = /.+github.com\/(.+)\/(.+)/;

export const Github_Pull_Request = z.looseObject({
	url: z.string(),
	id: z.number(),
	html_url: z.string(),
	number: z.number(),
	user: z.looseObject({
		login: z.string(),
	}),
});
export type Github_Pull_Request = z.infer<typeof Github_Pull_Request>;

/**
 * @see https://docs.github.com/en/rest/commits/commits?apiVersion=2022-11-28#list-pull-requests-associated-with-a-commit
 */
export const github_fetch_commit_prs = async (
	owner: string,
	repo: string,
	commit_sha: string,
	token?: string,
	log?: Logger,
	cache?: Fetch_Value_Cache,
	api_version?: string,
): Promise<Array<Github_Pull_Request> | null> => {
	const headers = api_version ? new Headers({'x-github-api-version': api_version}) : undefined;
	const url = `https://api.github.com/repos/${owner}/${repo}/commits/${commit_sha}/pulls`;
	const fetched = await fetch_value(url, {
		request: {headers},
		parse: (v: Array<any>) => v.map((p) => Github_Pull_Request.parse(p)),
		token,
		cache,
		return_early_from_cache: true,
		log,
	});
	if (!fetched.ok) return null;
	return fetched.value;
};
