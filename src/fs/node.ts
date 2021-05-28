import CheapWatch from 'cheap-watch';
import fsExtra from 'fs-extra';
import {sortMap, compareSimpleMapEntries} from '@feltcoop/felt/dist/utils/map.js';

import type {Filesystem, FsWriteFile} from './filesystem.js';
import type {PathStats} from './pathData.js';
import type {PathFilter} from './pathFilter.js';

// This uses `CheapWatch` which probably isn't the fastest, but it works fine for now.
// TODO should this API be changed to only include files and not directories?
// or maybe change the name so it's not misleading?
const findFiles = async (
	dir: string,
	filter?: PathFilter,
	// pass `null` to speed things up at the risk of rare misorderings
	sort: typeof compareSimpleMapEntries | null = compareSimpleMapEntries,
): Promise<Map<string, PathStats>> => {
	const watcher = new CheapWatch({
		dir,
		filter: filter
			? (file: {path: string; stats: PathStats}) => file.stats.isDirectory() || filter(file)
			: undefined,
		watch: false,
	});
	await watcher.init();
	watcher.close();
	return sort ? sortMap(watcher.paths, sort) : watcher.paths;
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
