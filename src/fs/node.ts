import fg from 'fast-glob';
import fsExtra from 'fs-extra';
import {sortMap, compareSimpleMapEntries} from '@feltjs/util/map.js';
import {stripStart} from '@feltjs/util/string.js';

import type {Filesystem, FsWriteFile} from './filesystem.js';
import type {PathStats} from './pathData.js';
import type {PathFilter} from './filter.js';

// TODO BLOCK should this API be changed to only include files and not directories?
// or maybe change the name so it's not misleading?
// The API only made sense when we were tied to cheap-watch.
const findFiles = async (
	dir: string,
	filter?: PathFilter,
	// pass `null` to speed things up at the risk of rare misorderings
	sort: typeof compareSimpleMapEntries | null = compareSimpleMapEntries,
): Promise<Map<string, PathStats>> => {
	const globbed = await fg.glob(dir + '/**/*');
	const paths: Map<string, PathStats> = new Map();
	for (const g of globbed) {
		const path = stripStart(g, dir);
		const stats = fsExtra.statSync(g);
		const file: {path: string; stats: PathStats} = {path, stats};
		if (!filter || stats.isDirectory() || filter(file)) {
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
