import {readFileSync} from 'fs'; // eslint-disable-line @typescript-eslint/no-restricted-imports
import {join} from 'path';
import {createFilter} from '@rollup/pluginutils';

import {
	GITIGNORE_FILENAME,
	GIT_DIRNAME,
	NODE_MODULES_DIRNAME,
	SVELTEKIT_DEV_DIRNAME,
} from '../paths.js';
import {type IdFilter} from '../fs/filter.js';

/*

This only handles the `gitignore` for the current working directory.

If we need support for Gro simultaneously, see ./packageJson.ts as an example.

*/

let filter: IdFilter | null = null;

const DEFAULT_IGNORED_PATHS = [
	GIT_DIRNAME,
	SVELTEKIT_DEV_DIRNAME,
	NODE_MODULES_DIRNAME,
	'.DS_Store',
];

// TODO need some mapping to match gitignore behavior correctly with nested directories
export const loadGitignoreFilter = (forceRefresh = false): IdFilter => {
	if (forceRefresh) filter = null;
	if (filter) return filter;
	let lines: string[];
	try {
		const gitignore = readFileSync(GITIGNORE_FILENAME, 'utf8');
		lines = gitignore
			.split('\n')
			.map((line) => line.trim())
			.filter(Boolean);
		lines.push(GIT_DIRNAME); // special lil case
	} catch (err) {
		lines = DEFAULT_IGNORED_PATHS;
	}
	filter = createFilter(lines.map((line) => toPattern(line)));
	return filter;
};

export const isGitignored = (path: string, root = process.cwd(), forceRefresh?: boolean): boolean =>
	loadGitignoreFilter(forceRefresh)(join(root, path));

// TODO What's the better way to do this?
// This is a quick hacky mapping for one use case between
// `.gitignore` and picomatch: https://github.com/micromatch/picomatch
// This code definitely fails for valid patterns!
const toPattern = (line: string): string => {
	let l = line;
	const firstChar = l[0];
	if (firstChar === '/') {
		l = l.substring(1);
	} else if (firstChar !== '*') {
		l = `**/${l}`;
	}
	const lastChar = l[l.length - 1];
	if (lastChar === '/') {
		l = `${l}**`;
	} else if (lastChar !== '*') {
		l = `${l}/**`;
	}
	return l;
};
