import {ensureDir} from '../fs/nodeFs.js';
import {DEBOUNCE_DEFAULT, watchNodeFs} from '../fs/watchNodeFs.js';
import type {WatchNodeFs} from '../fs/watchNodeFs.js';
import {Builder} from './builder.js';
import {UnreachableError} from '../utils/error.js';
import {PathStats} from '../fs/pathData.js';

// Compiled filer dirs are watched, compiled, and written to disk.
// For non-buildable dirs, the `dir` is only watched and nothing is written to the filesystem.
// Externals dirs require special handling - see the `Filer` for more.
export type FilerDir = BuildableFilerDir | NonBuildableInternalsFilerDir;
export type BuildableFilerDir = BuildableInternalsFilerDir | ExternalsFilerDir;
export type FilerDirType = 'files' | 'externals';
export interface BuildableInternalsFilerDir extends BaseFilerDir {
	readonly type: 'files';
	readonly buildable: true;
	readonly builder: Builder;
}
export interface NonBuildableInternalsFilerDir extends BaseFilerDir {
	readonly type: 'files';
	readonly buildable: false;
	readonly builder: null;
}
export interface ExternalsFilerDir extends BaseFilerDir {
	readonly type: 'externals';
	readonly buildable: true;
	readonly builder: Builder;
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
	type: FilerDirType,
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
	switch (type) {
		case 'files': {
			if (builder === null) {
				filerDir = {
					type: 'files',
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
					type: 'files',
					buildable: true,
					builder,
					dir,
					onChange,
					watcher,
					close,
					init,
				};
			}
			break;
		}
		case 'externals': {
			if (builder === null) {
				throw Error(`A builder is required for directories with type '${type}'.`);
			} else {
				filerDir = {
					type: 'externals',
					buildable: true,
					builder,
					dir,
					onChange,
					watcher,
					close,
					init,
				};
			}
			break;
		}
		default:
			throw new UnreachableError(type);
	}
	return filerDir;
};
