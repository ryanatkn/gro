import {ensureDir} from '../fs/nodeFs.js';
import {watchNodeFs, WatcherChange} from '../fs/watchNodeFs.js';
import type {WatchNodeFs} from '../fs/watchNodeFs.js';
import {paths} from '../paths.js';

// Compiled filer dirs are compiled and written to disk.
// For non-compilable dirs, the `dir` is only watched and nothing is written to the filesystem.
// Served filer dirs expose their files to queries in the Filer.
// A filer dir must be either compiled or served or both, because otherwise it does nothing!
export type FilerDir = CompilableFilerDir | NonCompilableFilerDir;
export type FilerDirChangeCallback = (change: WatcherChange, filerDir: FilerDir) => Promise<void>;
export interface CompilableFilerDir extends BaseFilerDir {
	readonly compilable: true;
}
export interface NonCompilableFilerDir extends BaseFilerDir {
	readonly compilable: false;
}

interface BaseFilerDir {
	readonly dir: string;
	readonly watcher: WatchNodeFs;
	readonly onChange: FilerDirChangeCallback;
	readonly close: () => void;
	readonly init: () => Promise<void>;
}

export const createFilerDir = (
	dir: string,
	compilable: boolean,
	watch: boolean,
	debounce: number,
	onChange: FilerDirChangeCallback,
): FilerDir => {
	const watcher = watchNodeFs({
		dir,
		debounce,
		watch,
		onChange: (change) => onChange(change, filerDir),
	});
	const close = () => {
		watcher.close();
	};
	const init = async () => {
		if (dir === paths.externals) console.log('init', dir);
		await ensureDir(dir);
		const statsBySourcePath = await watcher.init();
		if (dir === paths.externals) console.log('statsBySourcePath', statsBySourcePath);
		await Promise.all(
			Array.from(statsBySourcePath.entries()).map(([path, stats]) =>
				stats.isDirectory() ? null : onChange({type: 'update', path, stats}, filerDir),
			),
		);
	};
	const filerDir: FilerDir = {compilable, dir, onChange, watcher, close, init};
	return filerDir;
};
