import {readdir} from 'node:fs/promises';
import {sort_map, compare_simple_map_entries} from '@ryanatkn/belt/map.js';
import {EMPTY_OBJECT} from '@ryanatkn/belt/object.js';
import {to_array} from '@ryanatkn/belt/array.js';

import type {File_Filter, Path_Data, Path_Filter} from './path.js';
import {exists} from './fs.js';

export interface Search_Fs_Options {
	/**
	 * One or more filter functions, any of which can short-circuit the search by returning `false`.
	 */
	filter?: Path_Filter | Path_Filter[];
	/**
	 * An array of file suffixes to include.
	 */
	file_filter?: File_Filter | File_Filter[];
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
		file_filter,
		sort = compare_simple_map_entries,
		include_directories = false,
	} = options;

	const final_dir = dir.at(-1) === '/' ? dir : dir + '/';

	const filters =
		!filter || (Array.isArray(filter) && !filter.length) ? undefined : to_array(filter);
	const file_filters =
		!file_filter || (Array.isArray(file_filter) && !file_filter.length)
			? undefined
			: to_array(file_filter);

	if (!(await exists(final_dir))) return new Map();

	const paths: Map<string, Path_Data> = new Map();
	await crawl(final_dir, paths, filters, file_filters, include_directories, null);
	return sort ? sort_map(paths, sort) : paths;
};

// TODO BLOCK benchmark with sync calls here
const crawl = async (
	dir: string,
	paths: Map<string, Path_Data>,
	filters: Path_Filter[] | undefined,
	file_filter: File_Filter[] | undefined,
	include_directories: boolean,
	base_dir: string | null,
): Promise<Map<string, Path_Data>> => {
	const dirents = await readdir(dir, {withFileTypes: true});
	for (const dirent of dirents) {
		const {name, parentPath} = dirent;
		const is_directory = dirent.isDirectory();
		const id = parentPath + name;
		const include = !filters || filters.every((f) => f(id, is_directory));
		if (include) {
			const path = base_dir === null ? name : base_dir + '/' + name;
			if (is_directory) {
				const dir_id = id + '/';
				if (include_directories) {
					paths.set(path, {id: dir_id, is_directory: true});
				}
				await crawl(dir_id, paths, filters, file_filter, include_directories, path); // eslint-disable-line no-await-in-loop
			} else if (!file_filter || file_filter.every((f) => f(id))) {
				paths.set(path, {id, is_directory: false});
			}
		}
	}
	return paths;
};
