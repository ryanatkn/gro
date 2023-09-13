import chokidar, {type WatchOptions} from 'chokidar';
import {stat} from 'node:fs/promises';

import type {PathStats, PathFilter} from './path.js';
import {SOURCE_DIR, SOURCE_DIRNAME, paths, source_id_to_base_path} from './paths.js';

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
	on_change: WatcherChangeCallback;
	filter?: PathFilter | null | undefined;
	chokidar?: WatchOptions;
}

const FILE_STATS = {isDirectory: () => false};
const DIR_STATS = {isDirectory: () => true};

/**
 * Watch for changes on the filesystem using chokidar.
 */
export const watch_dir = (options: Options): WatchNodeFs => {
	const {dir, on_change, filter, chokidar: chokidar_options} = options;
	let watcher: chokidar.FSWatcher | undefined;

	return {
		init: async () => {
			watcher = chokidar.watch(dir, chokidar_options);

			watcher.on('add', async (path, s) => {
				const stats = s || (await stat(path));
				if (filter && !filter(path, stats)) return;
				on_change({type: 'create', path: toBasePath(path), stats});
			});
			watcher.on('addDir', async (path, s) => {
				const stats = s || (await stat(path));
				if (filter && !filter(path, stats)) return;
				on_change({type: 'create', path: toBasePath(path), stats});
			});
			watcher.on('change', async (path, s) => {
				const stats = s || (await stat(path));
				if (filter && !filter(path, stats)) return;
				on_change({type: 'update', path: toBasePath(path), stats});
			});
			watcher.on('unlink', (path) => {
				if (filter && !filter(path, FILE_STATS)) return;
				on_change({type: 'delete', path: toBasePath(path), stats: FILE_STATS});
			});
			watcher.on('unlinkDir', (path) => {
				if (filter && !filter(path, DIR_STATS)) return;
				on_change({type: 'delete', path: toBasePath(path), stats: DIR_STATS});
			});
		},
		close: async () => {
			if (!watcher) return;
			await watcher.close();
		},
	};
};

const toBasePath = (p: string): string => {
	// TODO this is terrible, handles the `src/` case having different
	if (p.endsWith(SOURCE_DIR) && paths.source.startsWith(p)) {
		return SOURCE_DIRNAME;
	}
	return source_id_to_base_path(p);
};
