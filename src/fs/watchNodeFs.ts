import CheapWatch from 'cheap-watch';

import {PathStats, PathFilter} from './pathData.js';
import {omitUndefined} from '../utils/object.js';

/*

`watchNodeFs` is Gro's low level interface for watching changes on the Node filesystem.
`Filer` is a high level interface that should be preferred when possible.

*/

export interface WatchNodeFs {
	init: () => Promise<Map<string, PathStats>>;
	destroy: () => void;
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
	filter: PathFilter | null;
	debounce: number;
	watch: boolean;
}
export type RequiredOptions = 'dir' | 'onChange';
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => ({
	debounce: DEBOUNCE_DEFAULT,
	filter: null,
	watch: true,
	...omitUndefined(opts),
});

export const watchNodeFs = (opts: InitialOptions): WatchNodeFs => {
	const {dir, onChange, filter, debounce, watch} = initOptions(opts);
	const watcher = new CheapWatch({
		dir,
		filter: filter
			? (file: {path: string; stats: PathStats}) => file.stats.isDirectory() || filter(file)
			: undefined,
		watch,
		debounce,
	});
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
		destroy: () => {
			watcher.close();
			watcher.removeAllListeners();
		},
	};
};
