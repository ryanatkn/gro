import CheapWatch from 'cheap-watch';

import type {PathStats} from 'src/fs/path_data.js';
import {to_path_filter} from './filter.js';
import type {PathFilter} from 'src/fs/filter.js';
import {load_gitignore_filter} from '../utils/gitignore.js';

/*

`watch_node_fs` is Gro's low level interface for watching changes on the Node filesystem.
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
	on_change: WatcherChangeCallback;
	filter?: PathFilter | null | undefined;
	watch?: boolean;
	debounce?: number;
}

export const watch_node_fs = (options: Options): WatchNodeFs => {
	const {
		dir,
		on_change,
		filter = to_default_filter(),
		watch = true,
		debounce = DEBOUNCE_DEFAULT,
	} = options;
	const watcher = new CheapWatch({dir, filter, watch, debounce});
	if (watch) {
		watcher.on('+', ({path, stats, is_new}) => {
			on_change({type: is_new ? 'create' : 'update', path, stats});
		});
		watcher.on('-', ({path, stats}) => {
			on_change({type: 'delete', path, stats});
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

const to_default_filter = (): PathFilter => to_path_filter(load_gitignore_filter());
