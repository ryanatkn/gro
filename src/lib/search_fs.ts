import glob from 'tiny-glob';
import {stat} from 'node:fs/promises';
import {sortMap, compareSimpleMapEntries} from '@grogarden/util/map.js';
import {stripEnd, stripStart} from '@grogarden/util/string.js';
import {EMPTY_OBJECT} from '@grogarden/util/object.js';

import type {PathStats, PathFilter} from './path.js';

export interface SearchFsOptions {
	filter?: PathFilter;
	/**
	 * Pass `null` to speed things up at the risk of volatile ordering.
	 */
	sort?: typeof compareSimpleMapEntries | null;
	files_only?: boolean;
}

export const search_fs = async (
	dir: string,
	options: SearchFsOptions = EMPTY_OBJECT,
): Promise<Map<string, PathStats>> => {
	const {filter, sort = compareSimpleMapEntries, files_only = true} = options;
	const final_dir = stripEnd(dir, '/');
	const globbed = await glob(final_dir + '/**/*', {absolute: true, filesOnly: files_only});
	const paths: Map<string, PathStats> = new Map();
	await Promise.all(
		globbed.map(async (g) => {
			const path = stripStart(g, final_dir + '/');
			const stats = await stat(g);
			if (!filter || stats.isDirectory() || filter(path, stats)) {
				paths.set(path, stats);
			}
		}),
	);
	return sort ? sortMap(paths, sort) : paths;
};
