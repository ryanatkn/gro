import chokidar from 'chokidar';
import {statSync} from 'node:fs'; // eslint-disable-line @typescript-eslint/no-restricted-imports

import type {PathStats} from '../path/pathData.js';
import {toPathFilter, type PathFilter} from './filter.js';
import {loadGitignoreFilter} from '../util/gitignore.js';
import {SOURCE_DIR, SOURCE_DIRNAME, paths, sourceIdToBasePath} from '../path/paths.js';

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

const FILE_STATS = {isDirectory: () => false};
const DIR_STATS = {isDirectory: () => true};

export const watchNodeFs = (options: Options): WatchNodeFs => {
	const {dir, onChange, filter = toDefaultFilter()} = options;
	let watcher: chokidar.FSWatcher | undefined;

	return {
		init: async () => {
			watcher = chokidar.watch(dir);

			watcher.on('add', (path, s) => {
				const stats = s || statSync(path);
				if (filter && !filter(path, stats)) return;
				onChange({type: 'create', path: toBasePath(path), stats});
			});
			watcher.on('addDir', (path, s) => {
				const stats = s || statSync(path);
				if (filter && !filter(path, stats)) return;
				onChange({type: 'create', path: toBasePath(path), stats});
			});
			watcher.on('change', (path, s) => {
				const stats = s || statSync(path);
				if (filter && !filter(path, stats)) return;
				onChange({type: 'update', path: toBasePath(path), stats});
			});
			watcher.on('unlink', (path) => {
				if (filter && !filter(path, FILE_STATS)) return;
				onChange({type: 'delete', path: toBasePath(path), stats: FILE_STATS});
			});
			watcher.on('unlinkDir', (path) => {
				if (filter && !filter(path, DIR_STATS)) return;
				onChange({type: 'delete', path: toBasePath(path), stats: DIR_STATS});
			});
		},
		close: async () => {
			if (!watcher) return;
			await watcher.close();
		},
	};
};

const toDefaultFilter = (): PathFilter => toPathFilter(loadGitignoreFilter());

const toBasePath = (p: string): string => {
	// TODO this is terrible, handles the `src/` case having different
	if (p.endsWith(SOURCE_DIR) && paths.source.startsWith(p)) {
		return SOURCE_DIRNAME;
	}
	return sourceIdToBasePath(p);
};