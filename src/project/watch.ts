import fs from 'fs-extra';

export interface CheapWatchPathAddedEvent {
	path: string;
	stats: fs.Stats;
	isNew: boolean;
}

export interface CheapWatchPathRemovedEvent {
	path: string;
	stats: fs.Stats;
}

export const DEBOUNCE_DEFAULT = 10;
