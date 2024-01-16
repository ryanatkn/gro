import glob from 'tiny-glob';
import {stat} from 'node:fs/promises';
import {sort_map, compare_simple_map_entries} from '@grogarden/util/map.js';
import {strip_end, strip_start} from '@grogarden/util/string.js';
import {EMPTY_OBJECT} from '@grogarden/util/object.js';

import type {Path_Stats, Path_Filter} from './path.js';
import {exists} from './fs.js';

export interface Search_Fs_Options {
	filter?: Path_Filter;
	/**
	 * Pass `null` to speed things up at the risk of volatile ordering.
	 */
	sort?: typeof compare_simple_map_entries | null;
	files_only?: boolean;
}

export const search_fs = async (
	dir: string,
	options: Search_Fs_Options = EMPTY_OBJECT,
): Promise<Map<string, Path_Stats>> => {
	const {filter, sort = compare_simple_map_entries, files_only = true} = options;
	const final_dir = strip_end(dir, '/');
	if (!(await exists(final_dir))) return new Map();
	const globbed = await glob(final_dir + '/**/*', {absolute: true, filesOnly: files_only});
	const paths: Map<string, Path_Stats> = new Map();
	await Promise.all(
		globbed.map(async (g) => {
			const path = strip_start(g, final_dir + '/');
			const stats = await stat(g);
			if (!filter || stats.isDirectory() || filter(path, stats)) {
				paths.set(path, stats);
			}
		}),
	);
	return sort ? sort_map(paths, sort) : paths;
};
