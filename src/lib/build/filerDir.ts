import {noop} from '@feltjs/util/function.js';

import {watchNodeFs, type WatchNodeFs} from '../fs/watchNodeFs.js';
import type {PathStats} from '../path/pathData.js';
import type {PathFilter} from '../fs/filter.js';
import type {Filesystem} from '../fs/filesystem.js';

// Filer dirs are watched, built, and written to disk.
export interface FilerDir {
	readonly dir: string;
	readonly onChange: FilerDirChangeCallback;
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
export type FilerDirChangeCallback = (change: FilerDirChange, filerDir: FilerDir) => Promise<void>;

export const create_filerDir = (
	fs: Filesystem,
	dir: string,
	onChange: FilerDirChangeCallback,
	watch: boolean,
	filter: PathFilter | undefined,
): FilerDir => {
	let close = noop;
	let watcher: WatchNodeFs | null = null;

	if (watch) {
		// TODO abstract this from the Node filesystem
		watcher = watchNodeFs({
			dir,
			onChange: (change) => onChange(change, filerDir),
			filter,
		});
		close = async () => {
			await watcher!.close();
		};
	}

	const init = async () => {
		await fs.ensureDir(dir);
		if (watcher) await watcher.init();
		const statsBySourcePath = await fs.findFiles(dir, filter);
		await Promise.all(
			Array.from(statsBySourcePath.entries()).map(([path, stats]) =>
				onChange({type: 'init', path, stats}, filerDir),
			),
		);
	};
	const filerDir: FilerDir = {dir, onChange, init, close, watcher};
	return filerDir;
};
