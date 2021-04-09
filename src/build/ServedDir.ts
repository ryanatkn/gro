import {resolve} from 'path';

import type {PartialExcept} from '../index.js';
import {stripStart} from '../utils/string.js';

export interface ServedDir {
	dir: string; // TODO rename? `source`, `sourceDir`, `path`
	servedAt: string; // TODO rename? `root`
	base: string; // relative path stripped from requests to support e.g. for GitHub pages this is the repo name
}

export type ServedDirPartial = string | PartialExcept<ServedDir, 'dir'>;

export const toServedDir = (dir: ServedDirPartial): ServedDir => {
	if (typeof dir === 'string') dir = {dir};
	const resolvedDir = resolve(dir.dir);
	return {
		dir: resolvedDir,
		base: dir.base ? baseToRelativePath(dir.base) : '', // see `baseToRelativePath` for more
		servedAt: dir.servedAt ? resolve(dir.servedAt) : resolvedDir,
	};
};

export const toServedDirs = (partials: ServedDirPartial[]): ServedDir[] => {
	const dirs = partials.map((d) => toServedDir(d));
	const uniqueDirs = new Set<string>();
	for (const dir of dirs) {
		// TODO instead of the error, should we allow multiple served paths for each input dir?
		// This is mainly done to prevent duplicate work in watching the source directories.
		if (uniqueDirs.has(dir.dir)) {
			throw Error(`Duplicate servedDirs are not allowed: ${dir.dir}`);
		}
		uniqueDirs.add(dir.dir);
	}
	return dirs;
};

// `base` is the same as in `ServedDir` above
export const stripBase = (path: string, base: string) => stripStart(stripStart(path, base), '/');

// for compatibility with SvelteKit, the incoming `base` value may have a leading / or ./ or be a .
const baseToRelativePath = (base: string): string => stripStart(stripStart(base, '.'), '/');
