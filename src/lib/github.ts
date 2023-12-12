// TODO if this grows at all, use `@octokit/request`,
// for now it's just calling a single endpoint so we do it manually
// and we specify just the types we need

import {z} from 'zod';

export const Github_Pull_Request = z.object({
	url: z.string(),
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
): Promise<Github_Pull_Request[]> => {
	const url = `https://api.github.com/repos/${owner}/${repo}/commits/${commit_sha}/pulls`;

	const headers: Record<string, string> = {accept: 'application/vnd.github+json'};
	if (token) {
		headers.bearer = token;
	}
	const res = await fetch(url, {headers});
	console.log(`res`, res);
	const json = await res.json();
	console.log(`json`, json);

	return json.map((j: unknown) => Github_Pull_Request.parse(j));
};
