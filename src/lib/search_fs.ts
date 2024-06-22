import glob from 'tiny-glob';
import {stat} from 'node:fs/promises';
import {sort_map, compare_simple_map_entries} from '@ryanatkn/belt/map.js';
import {strip_end, strip_start} from '@ryanatkn/belt/string.js';
import {EMPTY_OBJECT} from '@ryanatkn/belt/object.js';

import type {Path_Stats, Path_Filter} from './path.js';
import {exists} from './fs.js';

export interface Search_Fs_Options {
	filter?: Path_Filter;
	/**
	 * An array of file suffixes to include.
	 */
	suffixes?: string[];
	/**
	 * An array of paths to exclude relative to the search directory.
	 */
	exclude_paths?: string[];
	/**
	 * The root directory to search from. Defaults to the cwd.
	 */
	root_dir?: string;
	/**
	 * Pass `null` to speed things up at the risk of volatile ordering.
	 */
	sort?: typeof compare_simple_map_entries | null;
	/**
	 * Sets the `tiny-glob` `dot` option.
	 */
	dot?: boolean;
	/**
	 * Sets the `tiny-glob` `filesOnly` option.
	 */
	files_only?: boolean;
}

// TODO this is more complex than it needs to be because I kept an old interface when switching to globbing
export const search_fs = async (
	dir: string,
	options: Search_Fs_Options = EMPTY_OBJECT,
): Promise<Map<string, Path_Stats>> => {
	const {
		filter,
		suffixes,
		exclude_paths, // TODO BLOCK this doesn't work with `node_modules2` = ['node_modules'],
		root_dir = process.cwd(),
		sort = compare_simple_map_entries,
		dot = false,
		files_only = true,
	} = options;
	const final_dir = dir.at(-1) === '/' ? dir : dir + '/';
	if (!(await exists(final_dir))) return new Map();
	let pattern = final_dir;
	if (exclude_paths?.length) {
		pattern += `**/!(${exclude_paths.join('|')})/*`;
	} else {
		pattern += '**/*';
	}
	if (suffixes?.length) {
		pattern += `+(${suffixes.join('|')})`;
	}
	let cwd: string | undefined; // is set to the `final_root_dir` if `dir` is inside `root_dir`
	const final_root_dir = strip_end(root_dir, '/') + '/';
	if (pattern.startsWith(final_root_dir)) {
		pattern = pattern.substring(final_root_dir.length);
		cwd = final_root_dir;
	}
	console.log(`pattern`, pattern);
	const globbed = await glob(pattern, {absolute: true, dot, filesOnly: files_only, cwd});
	const paths: Map<string, Path_Stats> = new Map();
	console.log(`globbed`, globbed);
	await Promise.all(
		globbed.map(async (g) => {
			const path = strip_start(g, final_dir);
			const stats = await stat(g);
			if (!filter || stats.isDirectory() || filter(path, stats)) {
				paths.set(path, stats);
			}
		}),
	);
	return sort ? sort_map(paths, sort) : paths;
};
