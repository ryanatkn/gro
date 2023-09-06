import glob from 'tiny-glob';
import fsExtra from 'fs-extra';
import {sortMap, compareSimpleMapEntries} from '@feltjs/util/map.js';
import {stripEnd, stripStart} from '@feltjs/util/string.js';

import type {Filesystem, FsWriteFile} from './filesystem.js';
import type {PathStats} from '../path/pathData.js';
import type {PathFilter} from './filter.js';

const findFiles = async (
	dir: string,
	filter?: PathFilter,
	// pass `null` to speed things up at the risk of rare misorderings
	sort: typeof compareSimpleMapEntries | null = compareSimpleMapEntries,
): Promise<Map<string, PathStats>> => {
	const final_dir = stripEnd(dir, '/');
	const globbed = await glob(final_dir + '/**/*', {absolute: true, filesOnly: true});
	const paths: Map<string, PathStats> = new Map();
	for (const g of globbed) {
		const path = stripStart(g, final_dir + '/');
		const stats = fsExtra.statSync(g);
		if (!filter || stats.isDirectory() || filter(path, stats)) {
			paths.set(path, stats);
		}
	}
	return sort ? sortMap(paths, sort) : paths;
};

export const fs: Filesystem = {
	stat: fsExtra.stat,
	exists: fsExtra.pathExists,
	readFile: fsExtra.readFile,
	writeFile: fsExtra.outputFile as FsWriteFile, // TODO incompatible encodings: is this an actual problem? or is `fs-extra` mistyped? test with `null`
	remove: fsExtra.remove,
	move: fsExtra.move,
	copy: fsExtra.copy,
	readDir: fsExtra.readdir,
	emptyDir: fsExtra.emptyDir,
	ensureDir: fsExtra.ensureDir,
	findFiles,
};
