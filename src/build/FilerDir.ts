import {ensureDir} from '../fs/nodeFs.js';
import {DEBOUNCE_DEFAULT, watchNodeFs} from '../fs/watchNodeFs.js';
import type {WatchNodeFs} from '../fs/watchNodeFs.js';
import {Builder} from './builder.js';
import {PathStats} from '../fs/pathData.js';

// Buildable filer dirs are watched, built, and written to disk.
// For non-buildable dirs, the `dir` is only watched and nothing is written to the filesystem.
export type FilerDir = BuildableFilerDir | NonBuildableFilerDir;
export interface BuildableFilerDir extends BaseFilerDir {
	readonly buildable: true;
	readonly builder: Builder;
}
export interface NonBuildableFilerDir extends BaseFilerDir {
	readonly buildable: false;
	readonly builder: null;
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
	dir: string,
	builder: Builder | null,
	onChange: FilerDirChangeCallback,
	watch: boolean,
	watcherDebounce: number = DEBOUNCE_DEFAULT,
): FilerDir => {
	const watcher = watchNodeFs({
		dir,
		onChange: (change) => onChange(change, filerDir),
		debounce: watcherDebounce,
		watch,
	});
	const close = () => {
		watcher.close();
	};
	const init = async () => {
		await ensureDir(dir);
		const statsBySourcePath = await watcher.init();
		await Promise.all(
			Array.from(statsBySourcePath.entries()).map(([path, stats]) =>
				stats.isDirectory() ? null : onChange({type: 'init', path, stats}, filerDir),
			),
		);
	};
	let filerDir: FilerDir;
	if (builder === null) {
		filerDir = {
			buildable: false,
			builder: null,
			dir,
			onChange,
			watcher,
			close,
			init,
		};
	} else {
		filerDir = {
			buildable: true,
			builder,
			dir,
			onChange,
			watcher,
			close,
			init,
		};
	}
	return filerDir;
};
