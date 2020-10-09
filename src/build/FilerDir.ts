import {ensureDir} from '../fs/nodeFs.js';
import {watchNodeFs} from '../fs/watchNodeFs.js';
import type {WatchNodeFs} from '../fs/watchNodeFs.js';
import {Compiler} from '../compile/compiler.js';
import {UnreachableError} from '../utils/error.js';
import {PathStats} from '../fs/pathData.js';

// Compiled filer dirs are compiled and written to disk.
// For non-compilable dirs, the `dir` is only watched and nothing is written to the filesystem.
// Served filer dirs expose their files to queries in the Filer.
// A filer dir must be either compiled or served or both, because otherwise it does nothing!
export type FilerDir = CompilableFilerDir | NonCompilableFilerDir;
export type CompilableFilerDir = CompilableFilesFilerDir | PackagesFilerDir;
export type FilerDirType = 'files' | 'packages';
export interface CompilableFilesFilerDir extends BaseFilerDir {
	readonly type: 'files';
	readonly compilable: true;
	readonly compiler: Compiler;
}
export interface NonCompilableFilerDir extends BaseFilerDir {
	readonly type: 'files';
	readonly compilable: false;
	readonly compiler: null;
}
export interface PackagesFilerDir extends BaseFilerDir {
	readonly type: 'packages';
	readonly compilable: true;
	readonly compiler: Compiler;
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
	compiler: Compiler | null,
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
			if (compiler === null) {
				filerDir = {
					type: 'files',
					compilable: false,
					compiler: null,
					dir,
					onChange,
					watcher,
					close,
					init,
				};
			} else {
				filerDir = {
					type: 'files',
					compilable: true,
					compiler,
					dir,
					onChange,
					watcher,
					close,
					init,
				};
			}
			break;
		}
		case 'packages': {
			if (compiler === null) {
				throw Error(`A compiler is required for directories with type '${type}'.`);
			} else {
				filerDir = {
					type: 'packages',
					compilable: true,
					compiler,
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
