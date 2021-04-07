import CheapWatch from 'cheap-watch';

import type {PathStats, PathFilter} from './pathData.js';
import {omitUndefined} from '../utils/object.js';
import type {PartialExcept} from '../index.js';

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

// ignore some things in a typical Gro project
// note this set is exported & mutable 🤭
// TODO use gitignore? expose gitignore interface to gro users?
export const ignoredPaths = new Set(['.git', '.svelte', 'node_modules', '.DS_Store']);
const defaultFilter: PathFilter = (file) => !ignoredPaths.has(file.path);

export interface Options {
	dir: string;
	onChange: WatcherChangeCallback;
	filter: PathFilter | null;
	watch: boolean;
	debounce: number;
}
export type RequiredOptions = 'dir' | 'onChange';
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => ({
	filter: defaultFilter,
	watch: true,
	debounce: DEBOUNCE_DEFAULT,
	...omitUndefined(opts),
});

export const watchNodeFs = (opts: InitialOptions): WatchNodeFs => {
	const {dir, onChange, filter, debounce, watch} = initOptions(opts);
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
