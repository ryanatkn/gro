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

export const findFiles = async (
	dir: string,
	filter: (file: {path: string; stats: FileStats}) => boolean,
): Promise<Map<string, FileStats>> => {
	const watcher = new CheapWatch({
		dir,
		filter: (file: {path: string; stats: FileStats}) =>
			file.stats.isDirectory() || filter(file),
		watch: false,
		debounce: DEBOUNCE_DEFAULT,
	});
	await watcher.init();
	watcher.close();
	return watcher.paths;
};
