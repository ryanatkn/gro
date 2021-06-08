import {resolve} from 'path';
import type {Flavored} from '@feltcoop/felt/util/types.js';

import type {Encoding} from './encoding.js';
import type {Path_Stats} from './path_data.js';
import type {Path_Filter} from './path_filter.js';

// API is modeled after `fs-extra`: https://github.com/jprichardson/node-fs-extra/
export interface Filesystem {
	stat: FsStat;
	exists: FsExists;
	find_files: FsFindFiles;
	read_file: FsReadFile;
	write_file: FsWriteFile;
	remove: FsRemove;
	move: FsMove;
	copy: FsCopy;
	read_dir: FsReadDir;
	empty_dir: FsEmptyDir;
	ensure_dir: FsEnsureDir;
}

export interface FsStat {
	(path: string): Promise<Path_Stats>;
}
export interface FsExists {
	(path: string): Promise<boolean>;
}
export interface FsFindFiles {
	(
		dir: string,
		filter?: Path_Filter,
		// pass `null` to speed things up at the risk of infrequent misorderings (at least on Linux)
		sort?: ((a: [any, any], b: [any, any]) => number) | null,
	): Promise<Map<string, Path_Stats>>;
}
export interface FsReadFile {
	(path: string): Promise<Buffer>;
	(path: string, encoding: 'utf8'): Promise<string>;
	(path: string, encoding: null): Promise<Buffer>;
	(path: string, encoding?: Encoding): Promise<Buffer | string>;
}
export interface FsWriteFile {
	(path: string, data: any, encoding?: Encoding): Promise<void>;
}
export interface FsRemove {
	(path: string): Promise<void>;
}
export interface FsMove {
	(src: string, dest: string, options?: FsMoveOptions): Promise<void>; // TODO which options?
}
export interface FsCopy {
	(src: string, dest: string, options?: FsCopyOptions): Promise<void>; // TODO which options? all? breaks conventionn with above
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

// TODO try to implement some of these
export interface FsCopyOptions {
	// dereference?: boolean;
	overwrite?: boolean; // defaults to `true`
	// preserveTimestamps?: boolean;
	// errorOnExist?: boolean; // TODO implement this
	filter?: FsCopyFilterSync | FsCopyFilterAsync;
	// recursive?: boolean;
}
export interface FsMoveOptions {
	overwrite?: boolean;
	limit?: number;
}
export type FsCopyFilterSync = (src: string, dest: string) => boolean;
export type FsCopyFilterAsync = (src: string, dest: string) => Promise<boolean>;

export class FsStats implements Path_Stats {
	constructor(private readonly _isDirectory: boolean) {}
	isDirectory() {
		return this._isDirectory;
	}
}

export type FsId = Flavored<string, 'FsId'>;

// The `resolve` looks magic and hardcoded - it's matching how `fs` and `fs-extra` resolve paths.
export const toFsId = (path: string): FsId => resolve(path);

// TODO extract these? - how do they intersect with Filer types? and smaller interfaces like `Path_Data`?
export type FsNode = TextFileNode | BinaryFileNode | DirectoryNode;

// TODO should we use `Base_Filer_File` here?
// this mirrors a lot of that, except this models directories as well,
// which we wanted to upstream ..
// so this is a good entrypoint for backporting dirs into the Filer

// TODO names? should they have `Fs` prefix? extract?

export interface BaseNode {
	readonly id: FsId;
	readonly isDirectory: boolean;
	readonly encoding: Encoding;
	readonly contents: string | Buffer | null;
	// readonly contents_buffer: Buffer | null;
	readonly stats: Path_Stats;
	// readonly path_data: Path_Data; // TODO currently isn't used - rename? `PathInfo`? `PathMeta`? `Path`?
}
export interface BaseFileNode extends BaseNode {
	readonly isDirectory: false;
	readonly contents: string | Buffer;
}
export interface TextFileNode extends BaseFileNode {
	readonly encoding: 'utf8';
	readonly contents: string;
}
export interface BinaryFileNode extends BaseFileNode {
	readonly encoding: null;
	readonly contents: Buffer;
	// readonly contents_buffer: Buffer;
}
export interface DirectoryNode extends BaseNode {
	readonly isDirectory: true;
	readonly contents: null;
	// readonly contents_buffer: null;
}
