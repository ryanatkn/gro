import {noop} from '@feltcoop/felt/util/function.js';

import {watch_node_fs} from '../fs/watch_node_fs.js';
import type {WatchNodeFs} from 'src/fs/watch_node_fs.js';
import type {PathStats} from 'src/fs/path_data.js';
import type {PathFilter} from 'src/fs/filter.js';
import type {Filesystem} from 'src/fs/filesystem.js';

// Buildable filer dirs are watched, built, and written to disk.
// For non-buildable dirs, the `dir` is only watched and nothing is written to the filesystem.
export type FilerDir = BuildableFilerDir | NonBuildableFilerDir;
export interface BuildableFilerDir extends BaseFilerDir {
	readonly buildable: true;
}
export interface NonBuildableFilerDir extends BaseFilerDir {
	readonly buildable: false;
}
interface BaseFilerDir {
	readonly dir: string;
	readonly buildable: boolean;
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
export type FilerDirChangeCallback = (
	change: FilerDirChange,
	filer_dir: FilerDir,
) => Promise<void>;

export const create_filer_dir = (
	fs: Filesystem,
	dir: string,
	buildable: boolean,
	on_change: FilerDirChangeCallback,
	watch: boolean,
	watcher_debounce: number | undefined,
	filter: PathFilter | undefined,
): FilerDir => {
	if (watch) {
		// TODO abstract this from the Node filesystem
		const watcher = watch_node_fs({
			dir,
			on_change: (change) => on_change(change, filer_dir),
			watch,
			debounce: watcher_debounce,
			filter,
		});
		const close = () => {
			watcher.close();
		};
		const init = async () => {
			await fs.ensure_dir(dir);
			const stats_by_source_path = await watcher.init();
			await Promise.all(
				Array.from(stats_by_source_path.entries()).map(([path, stats]) =>
					stats.isDirectory() ? null : on_change({type: 'init', path, stats}, filer_dir),
				),
			);
		};
		const filer_dir: FilerDir = {buildable, dir, on_change, init, close, watcher};
		return filer_dir;
	} else {
		const init = async () => {
			await fs.ensure_dir(dir);
			const stats_by_source_path = await fs.find_files(dir, filter);
			await Promise.all(
				Array.from(stats_by_source_path.entries()).map(([path, stats]) =>
					stats.isDirectory() ? null : on_change({type: 'init', path, stats}, filer_dir),
				),
			);
		};
		const filer_dir: FilerDir = {buildable, dir, on_change, init, close: noop, watcher: null};
		return filer_dir;
	}
};
