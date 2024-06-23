import {readdir} from 'node:fs/promises';
import {sort_map, compare_simple_map_entries} from '@ryanatkn/belt/map.js';
import {EMPTY_OBJECT} from '@ryanatkn/belt/object.js';
import {to_array} from '@ryanatkn/belt/array.js';

import type {Path_Data, Path_Filter} from './path.js';
import {exists} from './fs.js';

export interface Search_Fs_Options {
	filter?: Path_Filter | Path_Filter[];
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
	 * Set to `false` to include directories.
	 */
	include_directories?: boolean;
}

// TODO this is terrible because of the `tiny-glob` limitations, rewrite without it, it's also making it exclude all directories that start with any of the excluded ones
export const search_fs = async (
	dir: string,
	options: Search_Fs_Options = EMPTY_OBJECT,
): Promise<Map<string, Path_Data>> => {
	const {
		filter,
		suffixes,
		root_dir = process.cwd(), // TODO BLOCK keep this?
		sort = compare_simple_map_entries,
		include_directories = false,
	} = options;

	const final_dir = dir.at(-1) === '/' ? dir : dir + '/';

	const filters =
		!filter || (Array.isArray(filter) && !filter.length) ? undefined : to_array(filter);

	if (!(await exists(final_dir))) return new Map();

	const paths: Map<string, Path_Data> = new Map();
	// {absolute: true, dot, filesOnly: files_only, cwd}
	const crawled = await crawl(final_dir, paths, filters, include_directories, suffixes);
	console.log(`crawled`, crawled);
	// eslint-disable-next-line no-await-in-loop
	// await Promise.all(
	// 	found.map(async (g) => {
	// 		const path = strip_start(g, final_dir);
	// 		const stats = await stat(g);
	// 		if (!filter || stats.isDirectory() || filter(path, stats)) {
	// 			paths.set(path, stats);
	// 		}
	// 	}),
	// );
	return sort ? sort_map(paths, sort) : paths;
};

// TODO BLOCK benchmark with sync calls here
const crawl = async (
	dir: string, // TODO BLOCK maybe need a `root_dir` passed as the final argument for recursion
	paths: Map<string, Path_Data>,
	filters: Path_Filter[] | undefined,
	include_directories: boolean,
	suffixes: string[] | undefined,
): Promise<Map<string, Path_Data>> => {
	const dirents = await readdir(dir, {withFileTypes: true});
	for (const dirent of dirents) {
		console.log(`found dirent`, dirent);
		const include = filters?.every((filter) =>
			filter(dirent.parentPath + dirent.name, dirent.isDirectory()),
		);
	}
	console.log(`found`, dirents);
	return paths;
};
