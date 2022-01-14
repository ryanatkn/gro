import {noop} from '@feltcoop/felt/util/function.js';

import {watchNodeFs} from '../fs/watchNodeFs.js';
import {type WatchNodeFs} from '../fs/watchNodeFs.js';
import {type PathStats} from '../fs/pathData.js';
import {type PathFilter} from '../fs/filter.js';
import {type Filesystem} from '../fs/filesystem.js';

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

export const createFilerDir = (
	fs: Filesystem,
	dir: string,
	buildable: boolean,
	onChange: FilerDirChangeCallback,
	watch: boolean,
	watcherDebounce: number | undefined,
	filter: PathFilter | undefined,
): FilerDir => {
	if (watch) {
		// TODO abstract this from the Node filesystem
		const watcher = watchNodeFs({
			dir,
			onChange: (change) => onChange(change, filerDir),
			watch,
			debounce: watcherDebounce,
			filter,
		});
		const close = () => {
			watcher.close();
		};
		const init = async () => {
			await fs.ensureDir(dir);
			const statsBySourcePath = await watcher.init();
			await Promise.all(
				Array.from(statsBySourcePath.entries()).map(([path, stats]) =>
					stats.isDirectory() ? null : onChange({type: 'init', path, stats}, filerDir),
				),
			);
		};
		const filerDir: FilerDir = {buildable, dir, onChange, init, close, watcher};
		return filerDir;
	} else {
		const init = async () => {
			await fs.ensureDir(dir);
			const statsBySourcePath = await fs.findFiles(dir, filter);
			await Promise.all(
				Array.from(statsBySourcePath.entries()).map(([path, stats]) =>
					stats.isDirectory() ? null : onChange({type: 'init', path, stats}, filerDir),
				),
			);
		};
		const filerDir: FilerDir = {buildable, dir, onChange, init, close: noop, watcher: null};
		return filerDir;
	}
};
