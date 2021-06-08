import {resolve} from 'path';
import type {PartialExcept} from '@feltcoop/felt/utils/types.js';
import {strip_start} from '@feltcoop/felt/utils/string.js';

export interface ServedDir {
	path: string;
	root: string;
	base: string; // relative path stripped from requests; for GitHub pages, this is the repo name
}

export type Served_Dir_Partial = string | PartialExcept<ServedDir, 'path'>;

export const toServedDir = (dir: Served_Dir_Partial): ServedDir => {
	if (typeof dir === 'string') dir = {path: dir};
	const resolvedDir = resolve(dir.path);
	return {
		path: resolvedDir,
		base: dir.base ? baseToRelativePath(dir.base) : '', // see `baseToRelativePath` for more
		root: dir.root ? resolve(dir.root) : resolvedDir,
	};
};

export const toServedDirs = (partials: Served_Dir_Partial[]): ServedDir[] => {
	const dirs = partials.map((d) => toServedDir(d));
	const uniqueDirs = new Set<string>();
	for (const dir of dirs) {
		// TODO instead of the error, should we allow multiple served paths for each input dir?
		// This is mainly done to prevent duplicate work in watching the source directories.
		if (uniqueDirs.has(dir.path)) {
			throw Error(`Duplicate served_dirs are not allowed: ${dir.path}`);
		}
		uniqueDirs.add(dir.path);
	}
	return dirs;
};

// `base` is the same as in `ServedDir` above
export const stripBase = (path: string, base: string) => strip_start(strip_start(path, base), '/');

// for compatibility with SvelteKit, the incoming `base` value may have a leading / or ./ or be a .
const baseToRelativePath = (base: string): string => strip_start(strip_start(base, '.'), '/');
