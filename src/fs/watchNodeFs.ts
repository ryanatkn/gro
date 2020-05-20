import CheapWatch from 'cheap-watch';

import {PathStats, PathFilter} from './pathData.js';
import {omitUndefined} from '../utils/object.js';

/*

`watchNodeFs` is Gro's low level interface
for watching changes on the Node filesystem.
For now, user code should use this for any filesystem watching needs,
but eventually its usage will be supplanted by a higher level interface
for watching a virtual filesystem
that provides automatic in-memory caching and platform independence.
`watchNodeFs` will be used by the higher level interface.

*/

export interface WatchNodeFs {
	init: Promise<void>;
	dispose: () => void;
}

export interface WatcherInitCallback {
	(paths: Map<string, PathStats>): void;
}

export interface WatcherChangeCallback {
	(change: WatcherChange, path: string, stats: PathStats): void;
}
export enum WatcherChange {
	Create,
	Update,
	Delete,
}

const DEBOUNCE_DEFAULT = 10;

export interface Options {
	dir: string;
	onInit: WatcherInitCallback;
	onChange: WatcherChangeCallback;
	filter: PathFilter | null;
	debounce: number;
}
export type RequiredOptions = 'dir' | 'onInit' | 'onChange';
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => ({
	debounce: DEBOUNCE_DEFAULT,
	filter: null,
	...omitUndefined(opts),
});

export const watchNodeFs = (opts: InitialOptions): WatchNodeFs => {
	const {dir, onChange, onInit, filter, debounce} = initOptions(opts);
	const watcher = new CheapWatch({
		dir,
		filter: filter
			? (file: {path: string; stats: PathStats}) => file.stats.isDirectory() || filter(file)
			: undefined,
		watch: true,
		debounce,
	});
	watcher.on('+', ({path, stats, isNew}) => {
		onChange(isNew ? WatcherChange.Create : WatcherChange.Update, path, stats);
	});
	watcher.on('-', ({path, stats}) => {
		onChange(WatcherChange.Delete, path, stats);
	});
	const init = watcher.init();
	init.then(() => onInit(watcher.paths));
	return {init, dispose: () => watcher.close()};
};
