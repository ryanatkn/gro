import CheapWatch from 'cheap-watch';

import type {PathStats} from './pathData.js';
import {toPathFilter, type PathFilter} from './filter.js';
import {loadGitignoreFilter} from '../utils/gitignore.js';

/*

`watchNodeFs` is Gro's low level interface for watching changes on the Node filesystem.
`Filer` is a high level interface that should be preferred when possible.

*/

export interface WatchNodeFs {
	init: () => Promise<Map<string, PathStats>>;
	close: () => void;
}

export interface WatcherChange {
	type: WatcherChangeType;
	path: string;
	stats: PathStats;
}
export type WatcherChangeType = 'create' | 'update' | 'delete';
export interface WatcherChangeCallback {
	(change: WatcherChange): void;
}

export const DEBOUNCE_DEFAULT = 10;

export interface Options {
	dir: string;
	onChange: WatcherChangeCallback;
	filter?: PathFilter | null | undefined;
	watch?: boolean;
	debounce?: number;
}

export const watchNodeFs = (options: Options): WatchNodeFs => {
	const {
		dir,
		onChange,
		filter = toDefaultFilter(),
		watch = true,
		debounce = DEBOUNCE_DEFAULT,
	} = options;
	const watcher = new CheapWatch({dir, filter, watch, debounce});
	if (watch) {
		watcher.on('+', ({path, stats, isNew}) => {
			onChange({type: isNew ? 'create' : 'update', path, stats});
		});
		watcher.on('-', ({path, stats}) => {
			onChange({type: 'delete', path, stats});
		});
	}
	return {
		init: async () => {
			await watcher.init();
			return watcher.paths;
		},
		close: () => {
			watcher.close();
			watcher.removeAllListeners();
		},
	};
};

const toDefaultFilter = (): PathFilter => toPathFilter(loadGitignoreFilter());
