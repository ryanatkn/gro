import glob from 'tiny-glob';
import {stat} from 'node:fs/promises';
import {sortMap, compareSimpleMapEntries} from '@feltjs/util/map.js';
import {stripEnd, stripStart} from '@feltjs/util/string.js';

import type {PathStats, PathFilter} from '../path/path.js';

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
