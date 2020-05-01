import CheapWatch from 'cheap-watch';

import {PathStats, PathFilter} from './pathData.js';

export interface CheapWatchPathAddedEvent {
	path: string;
	stats: PathStats;
	isNew: boolean;
}

export interface CheapWatchPathRemovedEvent {
	path: string;
	stats: PathStats;
}

export const DEBOUNCE_DEFAULT = 10;

// TODO should this API be changed to only include files and not directories?
// or maybe change the name so it's not misleading?
export const findFiles = async (
	dir: string,
	filter?: PathFilter,
): Promise<Map<string, PathStats>> => {
	const watcher = new CheapWatch({
		dir,
		filter: filter
			? (file: {path: string; stats: PathStats}) =>
					file.stats.isDirectory() || filter(file)
			: undefined,
		watch: false,
		debounce: DEBOUNCE_DEFAULT,
	});
	await watcher.init();
	watcher.close();
	return watcher.paths;
};
