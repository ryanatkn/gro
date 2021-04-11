import type {PathLike, Stats, CopyOptions, MoveOptions} from 'fs-extra';

import type {PathStats} from './pathData.js';
import type {PathFilter} from './pathFilter.js';

export type {Stats} from 'fs-extra';

export interface Filesystem {
	stat: FsStat;
	pathExists: FsPathExists;
	readFile: FsReadFile;
	readJson: FsReadJson;
	outputFile: FsOutputFile;
	remove: FsRemove;
	move: FsMove;
	copy: FsCopy;
	readDir: FsReadDir;
	emptyDir: FsEmptyDir;
	ensureDir: FsEnsureDir;
	findFiles: FsFindFiles;
}

export interface FsStat {
	(path: PathLike): Promise<Stats>;
}
export interface FsPathExists {
	(path: string): Promise<boolean>;
}
export interface FsReadFile {
	(file: PathLike | number): Promise<Buffer>;
	(file: PathLike | number, encoding: string): Promise<string>;
}
export interface FsReadJson {
	(file: string): Promise<any>;
}
export interface FsOutputFile {
	(file: string, data: any, encoding?: string): Promise<void>;
}
export interface FsRemove {
	(path: string): Promise<void>;
}
export interface FsMove {
	(src: string, dest: string, options?: MoveOptions): Promise<void>; // TODO which options?
}
export interface FsCopy {
	(src: string, dest: string, options?: CopyOptions): Promise<void>; // TODO which options? all? breaks conventionn with above
}
export interface FsReadDir {
	(path: string): Promise<string[]>;
}
export interface FsEmptyDir {
	(path: string): Promise<void>;
}
export interface FsEnsureDir {
	(path: string): Promise<void>;
}
export interface FsFindFiles {
	(
		dir: string,
		filter?: PathFilter,
		// pass `null` to speed things up at the risk of infrequent misorderings (at least on Linux)
		sort?: ((a: [any, any], b: [any, any]) => number) | null,
	): Promise<Map<string, PathStats>>;
}
