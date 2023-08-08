import chokidar from 'chokidar';
import {statSync} from 'node:fs'; // eslint-disable-line @typescript-eslint/no-restricted-imports

import type {PathStats} from './pathData.js';
import {toPathFilter, type PathFilter} from './filter.js';
import {loadGitignoreFilter} from '../utils/gitignore.js';

/*

`watchNodeFs` is Gro's low level interface for watching changes on the Node filesystem.
`Filer` is a high level interface that should be preferred when possible.

*/

export interface WatchNodeFs {
	init: () => Promise<void>;
	close: () => Promise<void>;
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

export interface Options {
	dir: string;
	onChange: WatcherChangeCallback;
	filter?: PathFilter | null | undefined;
}

export const watchNodeFs = (options: Options): WatchNodeFs => {
	const {dir, onChange, filter = toDefaultFilter()} = options;
	let watcher: chokidar.FSWatcher | undefined;

	return {
		init: async () => {
			watcher = chokidar.watch(dir);

			watcher.on('add', (path, stats) => {
				stats = stats || statSync(path); // eslint-disable-line no-param-reassign
				if (filter && !filter(path, stats)) return;
				onChange({type: 'create', path, stats});
			});
			watcher.on('addDir', (path, stats) => {
				stats = stats || statSync(path); // eslint-disable-line no-param-reassign
				if (filter && !filter(path, stats)) return;
				onChange({type: 'create', path, stats});
			});
			watcher.on('change', (path, stats) => {
				stats = stats || statSync(path); // eslint-disable-line no-param-reassign
				if (filter && !filter(path, stats)) return;
				onChange({type: 'update', path, stats});
			});
			watcher.on('unlink', (path) => {
				const stats = {isDirectory: () => false}; // TODO BLOCK hoist if working
				if (filter && !filter(path, stats)) return;
				onChange({type: 'delete', path, stats});
			});
			watcher.on('unlinkDir', (path) => {
				const stats = {isDirectory: () => true}; // TODO BLOCK hoist if working
				if (filter && !filter(path, stats)) return;
				onChange({type: 'delete', path, stats});
			});
		},
		close: async () => {
			if (!watcher) return;
			await watcher.close();
		},
	};
};

const toDefaultFilter = (): PathFilter => toPathFilter(loadGitignoreFilter());
