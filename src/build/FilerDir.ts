import {DEBOUNCE_DEFAULT, watchNodeFs} from '../fs/watchNodeFs.js';
import type {WatchNodeFs} from '../fs/watchNodeFs.js';
import type {PathFilter, PathStats} from '../fs/pathData.js';
import type {Filesystem} from '../fs/filesystem.js';

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
	readonly watcher: WatchNodeFs;
	readonly onChange: FilerDirChangeCallback;
	readonly close: () => void;
	readonly init: () => Promise<void>;
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
	filter: PathFilter | null,
	watch: boolean,
	watcherDebounce: number = DEBOUNCE_DEFAULT,
): FilerDir => {
	// TODO abstract this from the Node filesystem
	const watcher = watchNodeFs({
		dir,
		onChange: (change) => onChange(change, filerDir),
		filter,
		watch,
		debounce: watcherDebounce,
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
	const filerDir: FilerDir = {buildable, dir, onChange, watcher, close, init};
	return filerDir;
};
