import {EMPTY_OBJECT} from '@ryanatkn/belt/object.js';
import {to_array} from '@ryanatkn/belt/array.js';
import {ensure_end} from '@ryanatkn/belt/string.js';
import {isAbsolute, join} from 'node:path';
import {readdir} from 'node:fs/promises';
import {fs_exists} from '@ryanatkn/belt/fs.js';
import type {FileFilter, ResolvedPath, PathFilter} from '@ryanatkn/belt/path.js';

export interface SearchFsOptions {
	/**
	 * One or more filter functions, any of which can short-circuit the search by returning `false`.
	 */
	filter?: PathFilter | Array<PathFilter>;
	/**
	 * One or more file filter functions. Every filter must pass for a file to be included.
	 */
	file_filter?: FileFilter | Array<FileFilter>;
	/**
	 * Pass `null` or `false` to speed things up at the cost of volatile ordering.
	 */
	sort?: boolean | null | ((a: ResolvedPath, b: ResolvedPath) => number);
	/**
	 * Set to `true` to include directories. Defaults to `false`.
	 */
	include_directories?: boolean;
	/**
	 * Sets the cwd for `dir` unless it's an absolute path or `null`.
	 */
	cwd?: string | null;
}

export const search_fs = async (
	dir: string,
	options: SearchFsOptions = EMPTY_OBJECT,
): Promise<Array<ResolvedPath>> => {
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

	if (!(await fs_exists(final_dir))) return [];

	const paths: Array<ResolvedPath> = [];
	await crawl(final_dir, paths, filters, file_filters, include_directories, null);

	return sort ? paths.sort(typeof sort === 'boolean' ? default_sort : sort) : paths;
};

const default_sort = (a: ResolvedPath, b: ResolvedPath): number => a.path.localeCompare(b.path);

const crawl = async (
	dir: string,
	paths: Array<ResolvedPath>,
	filters: Array<PathFilter> | undefined,
	file_filter: Array<FileFilter> | undefined,
	include_directories: boolean,
	base_dir: string | null,
): Promise<Array<ResolvedPath>> => {
	const dirents = await readdir(dir, {withFileTypes: true});
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
			// eslint-disable-next-line no-await-in-loop
			await crawl(dir_id, paths, filters, file_filter, include_directories, path);
		} else if (!file_filter || file_filter.every((f) => f(id))) {
			paths.push({path, id, is_directory: false});
		}
	}
	return paths;
};

export const find_first_existing_file = async (paths: Array<string>): Promise<string | null> => {
	for (const path of paths) {
		// eslint-disable-next-line no-await-in-loop
		if (await fs_exists(path)) {
			return path;
		}
	}
	return null;
};
