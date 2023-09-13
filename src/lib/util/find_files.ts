import glob from 'tiny-glob';
import {statSync} from 'node:fs';
import {sortMap, compareSimpleMapEntries} from '@feltjs/util/map.js';
import {stripEnd, stripStart} from '@feltjs/util/string.js';

import type {PathStats} from '../path/path.js';
import type {PathFilter} from './filter.js';

export const find_files = async (
	dir: string,
	filter?: PathFilter,
	// pass `null` to speed things up at the risk of rare misorderings
	sort: typeof compareSimpleMapEntries | null = compareSimpleMapEntries,
	filesOnly = false,
): Promise<Map<string, PathStats>> => {
	const final_dir = stripEnd(dir, '/');
	const globbed = await glob(final_dir + '/**/*', {absolute: true, filesOnly});
	const paths: Map<string, PathStats> = new Map();
	for (const g of globbed) {
		const path = stripStart(g, final_dir + '/');
		const stats = statSync(g);
		if (!filter || stats.isDirectory() || filter(path, stats)) {
			paths.set(path, stats);
		}
	}
	return sort ? sortMap(paths, sort) : paths;
};
