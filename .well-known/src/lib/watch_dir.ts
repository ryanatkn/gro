import chokidar, {type WatchOptions} from 'chokidar';
import {stat} from 'node:fs/promises';
import {relative} from 'node:path';

import type {Path_Stats, Path_Filter} from './path.js';

// TODO pretty hacky

export interface Watch_Node_Fs {
	init: () => Promise<void>;
	close: () => Promise<void>;
}

export interface Watcher_Change {
	type: Watcher_Change_Type;
	path: string;
	stats: Path_Stats;
}
export type Watcher_Change_Type = 'create' | 'update' | 'delete';
export interface Watcher_Change_Callback {
	(change: Watcher_Change): void;
}

export interface Options {
	dir: string;
	on_change: Watcher_Change_Callback;
	filter?: Path_Filter | null | undefined;
	chokidar?: WatchOptions;
	/**
	 * When `false`, returns the `path` relative to `dir`.
	 * @default true
	 */
	absolute?: boolean;
}

const FILE_STATS = {isDirectory: () => false};
const DIR_STATS = {isDirectory: () => true};

/**
 * Watch for changes on the filesystem using chokidar.
 */
export const watch_dir = ({
	dir,
	on_change,
	filter,
	absolute = true,
	chokidar: chokidar_options,
}: Options): Watch_Node_Fs => {
	let watcher: chokidar.FSWatcher | undefined;

	return {
		init: async () => {
			watcher = chokidar.watch(dir, chokidar_options);
			watcher.on('add', async (path, s) => {
				const stats = s || (await stat(path));
				const final_path = absolute ? path : relative(dir, path);
				if (filter && !filter(final_path, stats)) return;
				on_change({type: 'create', path: final_path, stats});
			});
			watcher.on('addDir', async (path, s) => {
				const stats = s || (await stat(path));
				const final_path = absolute ? path : relative(dir, path);
				if (filter && !filter(final_path, stats)) return;
				on_change({type: 'create', path: final_path, stats});
			});
			watcher.on('change', async (path, s) => {
				const stats = s || (await stat(path));
				const final_path = absolute ? path : relative(dir, path);
				if (filter && !filter(final_path, stats)) return;
				on_change({type: 'update', path: final_path, stats});
			});
			watcher.on('unlink', (path) => {
				const final_path = absolute ? path : relative(dir, path);
				if (filter && !filter(final_path, FILE_STATS)) return;
				on_change({type: 'delete', path: final_path, stats: FILE_STATS});
			});
			watcher.on('unlinkDir', (path) => {
				const final_path = absolute ? path : relative(dir, path);
				if (filter && !filter(final_path, DIR_STATS)) return;
				on_change({type: 'delete', path: final_path, stats: DIR_STATS});
			});
			// wait until ready
			let resolve: any;
			const promise = new Promise((r) => (resolve = r));
			watcher.once('ready', () => resolve());
			await promise;
		},
		close: async () => {
			if (!watcher) return;
			await watcher.close();
		},
	};
};
