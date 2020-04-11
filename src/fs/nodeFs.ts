import CheapWatch from 'cheap-watch';

import {FileStats} from './fileData.js';

export interface CheapWatchPathAddedEvent {
	path: string;
	stats: FileStats;
	isNew: boolean;
}

export interface CheapWatchPathRemovedEvent {
	path: string;
	stats: FileStats;
}

export const DEBOUNCE_DEFAULT = 10;

// TODO should this API be changed to only include files and not directories?
// or maybe change the name so it's not misleading?
export const findFiles = async (
	dir: string,
	filter?: (file: {path: string; stats: FileStats}) => boolean,
): Promise<Map<string, FileStats>> => {
	const watcher = new CheapWatch({
		dir,
		filter: filter
			? (file: {path: string; stats: FileStats}) =>
					file.stats.isDirectory() || filter(file)
			: undefined,
		watch: false,
		debounce: DEBOUNCE_DEFAULT,
	});
	await watcher.init();
	watcher.close();
	return watcher.paths;
};
