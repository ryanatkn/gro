import {readdir} from 'node:fs/promises';
import {EMPTY_OBJECT} from '@ryanatkn/belt/object.js';
import {to_array} from '@ryanatkn/belt/array.js';
import {ensure_end} from '@ryanatkn/belt/string.js';
import {isAbsolute, join} from 'node:path';

import type {File_Filter, Resolved_Path, Path_Filter} from './path.js';
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
	 * Pass `null` or `false` to speed things up at the risk of volatile ordering.
	 */
	sort?: boolean | null | ((a: Resolved_Path, b: Resolved_Path) => number);
	/**
	 * Set to `false` to include directories.
	 */
	include_directories?: boolean;
	/**
	 * Sets the cwd for `dir` unless it's an absolute path or `null`.
	 */
	cwd?: string | null;
}

// TODO this is terrible because of the `tiny-glob` limitations, rewrite without it, it's also making it exclude all directories that start with any of the excluded ones
export const search_fs = async (
	dir: string,
	options: Search_Fs_Options = EMPTY_OBJECT,
): Promise<Resolved_Path[]> => {
	const {
		filter,
		file_filter,
		sort = default_sort,
		include_directories = false,
		cwd = process.cwd(),
	} = options;

	const final_dir = ensure_end(cwd && !isAbsolute(dir) ? join(cwd, dir) : dir, '/');

	const filters =
		!filter || (Array.isArray(filter) && !filter.length) ? undefined : to_array(filter);
	const file_filters =
		!file_filter || (Array.isArray(file_filter) && !file_filter.length)
			? undefined
			: to_array(file_filter);

	if (!(await exists(final_dir))) return [];

	const paths: Resolved_Path[] = [];
	await crawl(final_dir, paths, filters, file_filters, include_directories, null);

	return sort ? paths.sort(typeof sort === 'boolean' ? default_sort : sort) : paths;
};

const default_sort = (a: Resolved_Path, b: Resolved_Path): number => a.path.localeCompare(b.path);

// TODO BLOCK benchmark with sync calls here
const crawl = async (
	dir: string,
	paths: Resolved_Path[],
	filters: Path_Filter[] | undefined,
	file_filter: File_Filter[] | undefined,
	include_directories: boolean,
	base_dir: string | null,
): Promise<Resolved_Path[]> => {
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
					paths.push({path, id: dir_id, is_directory: true});
				}
				await crawl(dir_id, paths, filters, file_filter, include_directories, path); // eslint-disable-line no-await-in-loop
			} else if (!file_filter || file_filter.every((f) => f(id))) {
				paths.push({path, id, is_directory: false});
			}
		}
	}
	return paths;
};
