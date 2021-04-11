import CheapWatch from 'cheap-watch';
import fsExtra from 'fs-extra';

import type {Filesystem} from './filesystem.js';
import type {PathStats} from './pathData.js';
import {sortMap, compareSimpleMapEntries} from '../utils/map.js';
import type {PathFilter} from './pathData.js';

// This uses `CheapWatch` which probably isn't the fastest, but it works fine for now.
// TODO should this API be changed to only include files and not directories?
// or maybe change the name so it's not misleading?
export const findFiles = async (
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

/*

Re-export the functions we use from `fs-extra`.
The reason is twofold.

1. `fs-extra` doesn't support named imports yet.
https://github.com/jprichardson/node-fs-extra/issues/746

2. We want to minimize our code's reliance
to the Node platform when the cost and friction are low.
Eventually we'll want our code to run on other platforms, like Deno,
and this practice will make future interop or migration more feasible.

All of these functions return promises.
This is important because they will conform to a future filesystem host interface,
and because we need to support contexts like the browser and who knows what remote servers,
an async-only filesystem interface is the way to go.

*/
export const stat = fsExtra.stat;
export const pathExists = fsExtra.pathExists;
export const readFile = fsExtra.readFile;
export const readJson = fsExtra.readJson;
export const outputFile = fsExtra.outputFile;
export const remove = fsExtra.remove;
export const move = fsExtra.move;
export const copy = fsExtra.copy;
export const readDir = fsExtra.readdir;
export const emptyDir = fsExtra.emptyDir;
export const ensureDir = fsExtra.ensureDir;

export const nodeFilesystem: Filesystem = {
	stat,
	pathExists,
	readFile,
	readJson,
	outputFile,
	remove,
	move,
	copy,
	readDir,
	emptyDir,
	ensureDir,
	findFiles,
};
