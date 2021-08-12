import {readFileSync} from 'fs';
import {join} from 'path';
import {createFilter} from '@rollup/pluginutils';

import {
	GITIGNORE_FILENAME,
	GIT_DIRNAME,
	NODE_MODULES_DIRNAME,
	SVELTEKIT_DEV_DIRNAME,
} from '../paths.js';
import type {IdFilter} from 'src/fs/filter.js';

/*

This only handles the `gitignore` for the current working directory.

If we need support for Gro simultaneously, see ./package_json.ts as an example.

*/

let filter: IdFilter | null = null;

const DEFAULT_IGNORED_PATHS = [
	GIT_DIRNAME,
	SVELTEKIT_DEV_DIRNAME,
	NODE_MODULES_DIRNAME,
	'.DS_Store',
];

// TODO need some mapping to match gitignore behavior correctly with nested directories
export const load_gitignore_filter = (force_refresh = false): IdFilter => {
	if (force_refresh) filter = null;
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
	filter = createFilter(lines.map((line) => to_pattern(line)));
	return filter;
};

export const is_gitignored = (path: string, root = process.cwd(), force_refresh?: boolean) =>
	load_gitignore_filter(force_refresh)(join(root, path));

// TODO What's the better way to do this?
// This is a quick hacky mapping for one use case between
// `.gitignore` and picomatch: https://github.com/micromatch/picomatch
// This code definitely fails for valid patterns!
const to_pattern = (line: string): string => {
	const first_char = line[0];
	if (first_char === '/') {
		line = line.substring(1);
	} else if (first_char !== '*') {
		line = `**/${line}`;
	}
	const last_char = line[line.length - 1];
	if (last_char === '/') {
		line = `${line}**`;
	} else if (last_char !== '*') {
		line = `${line}/**`;
	}
	return line;
};
