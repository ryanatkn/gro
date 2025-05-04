import {EMPTY_OBJECT} from '@ryanatkn/belt/object.js';
import {to_array} from '@ryanatkn/belt/array.js';
import {ensure_end} from '@ryanatkn/belt/string.js';
import {isAbsolute, join} from 'node:path';
import {existsSync, readdirSync} from 'node:fs';

import type {File_Filter, Resolved_Path, Path_Filter} from './path.ts';

export interface Search_Fs_Options {
	/**
	 * One or more filter functions, any of which can short-circuit the search by returning `false`.
	 */
	filter?: Path_Filter | Array<Path_Filter>;
	/**
	 * One or more file filter functions. Every filter must pass for a file to be included.
	 */
	file_filter?: File_Filter | Array<File_Filter>;
	/**
	 * Pass `null` or `false` to speed things up at the cost of volatile ordering.
	 */
	sort?: boolean | null | ((a: Resolved_Path, b: Resolved_Path) => number);
	/**
	 * Set to `true` to include directories. Defaults to `false`.
	 */
	include_directories?: boolean;
	/**
	 * Sets the cwd for `dir` unless it's an absolute path or `null`.
	 */
	cwd?: string | null;
}

export const search_fs = (
	dir: string,
	options: Search_Fs_Options = EMPTY_OBJECT,
): Array<Resolved_Path> => {
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

	if (!existsSync(final_dir)) return [];

	const paths: Array<Resolved_Path> = [];
	crawl(final_dir, paths, filters, file_filters, include_directories, null);

	return sort ? paths.sort(typeof sort === 'boolean' ? default_sort : sort) : paths;
};

const default_sort = (a: Resolved_Path, b: Resolved_Path): number => a.path.localeCompare(b.path);

const crawl = (
	dir: string,
	paths: Array<Resolved_Path>,
	filters: Array<Path_Filter> | undefined,
	file_filter: Array<File_Filter> | undefined,
	include_directories: boolean,
	base_dir: string | null,
): Array<Resolved_Path> => {
	// This sync version is significantly faster than using the `fs/promises` version -
	// it doesn't parallelize but that's not the common case in Gro.
	const dirents = readdirSync(dir, {withFileTypes: true});
	for (const dirent of dirents) {
		const {name, parentPath} = dirent;
		const is_directory = dirent.isDirectory();
		const id = parentPath + name;
		const include = !filters || filters.every((f) => f(id, is_directory));
		if (!include) continue;
		const path = base_dir === null ? name : base_dir + '/' + name;
		if (is_directory) {
			const dir_id = id + '/';
			if (include_directories) {
				paths.push({path, id: dir_id, is_directory: true});
			}
			crawl(dir_id, paths, filters, file_filter, include_directories, path);
		} else if (!file_filter || file_filter.every((f) => f(id))) {
			paths.push({path, id, is_directory: false});
		}
	}
	return paths;
};

export const find_first_existing_file = (paths: Array<string>): string | null => {
	for (const path of paths) {
		if (existsSync(path)) {
			return path;
		}
	}
	return null;
};
