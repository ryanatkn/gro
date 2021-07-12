import {noop} from '@feltcoop/felt/util/function.js';

import {watch_node_fs} from '../fs/watch_node_fs.js';
import type {Watch_Node_Fs} from 'src/fs/watch_node_fs.js';
import type {Path_Stats} from 'src/fs/path_data.js';
import type {Path_Filter} from 'src/fs/filter.js';
import type {Filesystem} from 'src/fs/filesystem.js';

// Buildable filer dirs are watched, built, and written to disk.
// For non-buildable dirs, the `dir` is only watched and nothing is written to the filesystem.
export type Filer_Dir = Buildable_Filer_Dir | Non_Buildable_Filer_Dir;
export interface Buildable_Filer_Dir extends Base_Filer_Dir {
	readonly buildable: true;
}
export interface Non_Buildable_Filer_Dir extends Base_Filer_Dir {
	readonly buildable: false;
}
interface Base_Filer_Dir {
	readonly dir: string;
	readonly buildable: boolean;
	readonly on_change: Filer_Dir_Change_Callback;
	readonly init: () => Promise<void>;
	readonly close: () => void;
	readonly watcher: Watch_Node_Fs | null;
}

export interface Filer_Dir_Change {
	type: Filer_Dir_Change_Type;
	path: string;
	stats: Path_Stats;
}
export type Filer_Dir_Change_Type = 'init' | 'create' | 'update' | 'delete';
export type Filer_Dir_Change_Callback = (
	change: Filer_Dir_Change,
	filer_dir: Filer_Dir,
) => Promise<void>;

export const create_filer_dir = (
	fs: Filesystem,
	dir: string,
	buildable: boolean,
	on_change: Filer_Dir_Change_Callback,
	watch: boolean,
	watcher_debounce: number | undefined,
	filter: Path_Filter | undefined,
): Filer_Dir => {
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
		const filer_dir: Filer_Dir = {buildable, dir, on_change, init, close, watcher};
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
		const filer_dir: Filer_Dir = {buildable, dir, on_change, init, close: noop, watcher: null};
		return filer_dir;
	}
};
