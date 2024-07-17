import {strip_start, strip_end, ensure_end} from '@ryanatkn/belt/string.js';

import type {Package_Json, Url} from './package_json.js';
import type {Src_Json} from './src_json.js';

// TODO needs refactoring, more clarity
export interface Package_Meta {
	repo_url: Url; // 'https://github.com/ryanatkn/fuz'
	package_json: Package_Json;
	src_json: Src_Json;
	name: string; // '@ryanatkn/fuz_library'
	repo_name: string; // fuz_library
	/**
	 * the is the github user/org, not npm
	 */
	owner_name: string | null; // 'fuz-dev'
	homepage_url: Url | null; // 'https://www.fuz.dev/'
	logo_url: Url | null; // 'https://www.fuz.dev/logo.svg' falling back to 'https://www.fuz.dev/favicon.png'
	logo_alt: string; // 'icon for gro'
	npm_url: Url | null; // 'https://npmjs.com/package/@ryanatkn/fuz_library'
	changelog_url: Url | null;
	published: boolean;
}

export const parse_package_meta = (
	package_json: Package_Json,
	src_json: Src_Json,
): Package_Meta => {
	const {name} = package_json;

	// TODO hacky
	const parse_repo = (r: string | null | undefined) => {
		if (!r) return null;
		return strip_end(strip_start(strip_end(r, '.git'), 'git+'), '/');
	};

	const repo_url = parse_repo(
		package_json.repository
			? typeof package_json.repository === 'string'
				? package_json.repository
				: package_json.repository.url
			: null,
	);
	if (!repo_url) {
		throw new Error('failed to parse package_meta - `repo_url` is required in package_json');
	}

	const homepage_url = package_json.homepage ?? null;

	const published =
		!package_json.private && !!package_json.exports && package_json.version !== '0.0.1';

	// TODO generic registries
	const npm_url = published ? 'https://www.npmjs.com/package/' + package_json.name : null;

	const changelog_url = published && repo_url ? repo_url + '/blob/main/CHANGELOG.md' : null;

	const repo_name = parse_repo_name(name);

	const owner_name = repo_url ? strip_start(repo_url, 'https://github.com/').split('/')[0] : null;

	const logo_url = homepage_url
		? ensure_end(homepage_url, '/') +
			(package_json.logo ? strip_start(package_json.logo, '/') : 'favicon.png')
		: null;

	const logo_alt = package_json.logo_alt ?? `logo for ${repo_name}`;

	return {
		package_json,
		src_json,
		name,
		repo_name,
		repo_url,
		owner_name,
		homepage_url,
		logo_url,
		logo_alt,
		npm_url,
		changelog_url,
		published,
	};
};

// TODO proper parsing
export const parse_repo_name = (name: string): string =>
	name[0] === '@' ? name.split('/')[1] : name;

export const parse_org_url = (pkg: Package_Meta): string | null => {
	const {repo_name, repo_url} = pkg;
	if (!repo_url) return null;
	const suffix = '/' + repo_name;
	if (repo_url.endsWith(suffix)) {
		return strip_end(repo_url, suffix);
	}
	return null;
};
