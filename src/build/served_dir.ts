import {resolve} from 'path';
import type {Partial_Except} from '@feltcoop/felt/util/types.js';
import {strip_start} from '@feltcoop/felt/util/string.js';

export interface Served_Dir {
	path: string;
	root: string;
	base: string; // relative path stripped from requests; for GitHub pages, this is the repo name
}

export type Served_Dir_Partial = string | Partial_Except<Served_Dir, 'path'>;

export const to_served_dir = (dir: Served_Dir_Partial): Served_Dir => {
	if (typeof dir === 'string') dir = {path: dir};
	const resolved_dir = resolve(dir.path);
	return {
		path: resolved_dir,
		base: dir.base ? base_to_relative_path(dir.base) : '', // see `base_to_relative_path` for more
		root: dir.root ? resolve(dir.root) : resolved_dir,
	};
};

export const to_served_dirs = (partials: Served_Dir_Partial[]): Served_Dir[] => {
	const dirs = partials.map((d) => to_served_dir(d));
	const unique_dirs = new Set<string>();
	for (const dir of dirs) {
		// TODO instead of the error, should we allow multiple served paths for each input dir?
		// This is mainly done to prevent duplicate work in watching the source directories.
		if (unique_dirs.has(dir.path)) {
			throw Error(`Duplicate served_dirs are not allowed: ${dir.path}`);
		}
		unique_dirs.add(dir.path);
	}
	return dirs;
};

// `base` is the same as in `Served_Dir` above
export const strip_base = (path: string, base: string) => strip_start(strip_start(path, base), '/');

// for compatibility with SvelteKit, the incoming `base` value may have a leading / or ./ or be a .
const base_to_relative_path = (base: string): string => strip_start(strip_start(base, '.'), '/');
