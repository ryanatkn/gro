import {noop} from '@feltcoop/felt/utils/function.js';

import {watchNodeFs} from '../fs/watchNodeFs.js';
import type {WatchNodeFs} from '../fs/watchNodeFs.js';
import type {Path_Stats} from '../fs/path_data.js';
import type {Path_Filter} from '../fs/path_filter.js';
import type {Filesystem} from '../fs/filesystem.js';

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
	readonly onChange: Filer_Dir_Change_Callback;
	readonly init: () => Promise<void>;
	readonly close: () => void;
	readonly watcher: WatchNodeFs | null;
}

export interface Filer_DirChange {
	type: Filer_DirChangeType;
	path: string;
	stats: Path_Stats;
}
export type Filer_DirChangeType = 'init' | 'create' | 'update' | 'delete';
export type Filer_Dir_Change_Callback = (
	change: Filer_DirChange,
	filer_dir: Filer_Dir,
) => Promise<void>;

export const create_filer_dir = (
	fs: Filesystem,
	dir: string,
	buildable: boolean,
	onChange: Filer_Dir_Change_Callback,
	watch: boolean,
	watcherDebounce: number | undefined,
	filter: Path_Filter | undefined,
): Filer_Dir => {
	if (watch) {
		// TODO abstract this from the Node filesystem
		const watcher = watchNodeFs({
			dir,
			onChange: (change) => onChange(change, filer_dir),
			watch,
			debounce: watcherDebounce,
			filter,
		});
		const close = () => {
			watcher.close();
		};
		const init = async () => {
			await fs.ensure_dir(dir);
			const statsBySourcePath = await watcher.init();
			await Promise.all(
				Array.from(statsBySourcePath.entries()).map(([path, stats]) =>
					stats.isDirectory() ? null : onChange({type: 'init', path, stats}, filer_dir),
				),
			);
		};
		const filer_dir: Filer_Dir = {buildable, dir, onChange, init, close, watcher};
		return filer_dir;
	} else {
		const init = async () => {
			await fs.ensure_dir(dir);
			const statsBySourcePath = await fs.find_files(dir, filter);
			await Promise.all(
				Array.from(statsBySourcePath.entries()).map(([path, stats]) =>
					stats.isDirectory() ? null : onChange({type: 'init', path, stats}, filer_dir),
				),
			);
		};
		const filer_dir: Filer_Dir = {buildable, dir, onChange, init, close: noop, watcher: null};
		return filer_dir;
	}
};
