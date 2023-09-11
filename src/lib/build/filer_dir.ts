import {noop} from '@feltjs/util/function.js';

import {watch_dir, type WatchNodeFs} from '../util/watch_dir.js';
import type {PathStats} from '../path/path_data.js';
import type {PathFilter} from '../util/filter.js';
import {find_files} from '../util/find_files.js';
import {mkdirSync} from 'node:fs';

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
	dir: string,
	on_change: FilerDirChangeCallback,
	watch: boolean,
	filter: PathFilter | undefined,
): FilerDir => {
	let close = noop;
	let watcher: WatchNodeFs | null = null;

	if (watch) {
		watcher = watch_dir({
			dir,
			on_change: (change) => on_change(change, filer_dir),
			filter,
		});
		close = async () => {
			await watcher!.close();
		};
	}

	const init = async () => {
		mkdirSync(dir, {recursive: true});
		if (watcher) await watcher.init();
		const stats_by_source_path = await find_files(dir, filter);
		await Promise.all(
			Array.from(stats_by_source_path.entries()).map(([path, stats]) =>
				on_change({type: 'init', path, stats}, filer_dir),
			),
		);
	};
	const filer_dir: FilerDir = {dir, on_change, init, close, watcher};
	return filer_dir;
};
