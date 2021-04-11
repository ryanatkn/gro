import {join} from 'path';
import CheapWatch from 'cheap-watch';

import type {PathFilter, PathStats} from './pathData.js';
import {paths} from '../paths.js';
import {omitUndefined} from '../utils/object.js';
import type {PartialExcept} from '../index.js';
import type {FileFilter} from './file.js';
import {loadGitignoreFilter} from '../project/gitignore.js';
import type {Filesystem} from './filesystem.js';

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
	filter: PathFilter | null;
	watch: boolean;
	debounce: number;
}
export type RequiredOptions = 'dir' | 'onChange';
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => ({
	watch: true,
	debounce: DEBOUNCE_DEFAULT,
	...omitUndefined(opts),
	filter: opts.filter === undefined ? toDefaultFilter() : opts.filter,
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

// TODO refactor these

const toPathFilter = (filter: FileFilter, root = paths.root): PathFilter => ({path}) =>
	!filter(join(root, path));

const toDefaultFilter = (): PathFilter => {
	const gitignoreFilter = loadGitignoreFilter();
	return toPathFilter(gitignoreFilter);
};
