import {noop} from '@feltjs/util/function.js';

import {watchNodeFs, type WatchNodeFs} from '../fs/watchNodeFs.js';
import type {PathStats} from '../path/path_data.js';
import type {PathFilter} from '../fs/filter.js';
import type {Filesystem} from '../fs/filesystem.js';

// Filer dirs are watched, built, and written to disk.
export interface FilerDir {
	readonly dir: string;
	readonly on_change: FilerDirChangeCallback;
	readonly init: () => Promise<void>;
	readonly close: () => void;
	readonly watcher: WatchNodeFs | null;
}

export interface FilerDirChange {
	type: FilerDirChangeType;
	path: string;
	stats: PathStats;
}
export type FilerDirChangeType = 'init' | 'create' | 'update' | 'delete';
export type FilerDirChangeCallback = (change: FilerDirChange, filer_dir: FilerDir) => Promise<void>;

export const create_filer_dir = (
	fs: Filesystem,
	dir: string,
	on_change: FilerDirChangeCallback,
	watch: boolean,
	filter: PathFilter | undefined,
): FilerDir => {
	let close = noop;
	let watcher: WatchNodeFs | null = null;

	if (watch) {
		// TODO abstract this from the Node filesystem
		watcher = watchNodeFs({
			dir,
			on_change: (change) => on_change(change, filer_dir),
			filter,
		});
		close = async () => {
			await watcher!.close();
		};
	}

	const init = async () => {
		await fs.ensureDir(dir);
		if (watcher) await watcher.init();
		const stats_by_source_path = await fs.findFiles(dir, filter);
		await Promise.all(
			Array.from(stats_by_source_path.entries()).map(([path, stats]) =>
				on_change({type: 'init', path, stats}, filer_dir),
			),
		);
	};
	const filer_dir: FilerDir = {dir, on_change, init, close, watcher};
	return filer_dir;
};
