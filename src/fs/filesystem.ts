import {resolve} from 'path';
import type {Flavored} from '@feltcoop/felt/util/types.js';

import type {Encoding} from 'src/fs/encoding.js';
import type {PathStats} from 'src/fs/path_data.js';
import type {PathFilter} from 'src/fs/filter.js';

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
	(path: string): Promise<PathStats>;
}
export interface FsExists {
	(path: string): Promise<boolean>;
}
export interface FsFindFiles {
	(
		dir: string,
		filter?: PathFilter,
		// pass `null` to speed things up at the risk of infrequent misorderings (at least on Linux)
		sort?: ((a: [any, any], b: [any, any]) => number) | null,
	): Promise<Map<string, PathStats>>;
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

export class FsStats implements PathStats {
	constructor(private readonly _is_directory: boolean) {}
	isDirectory() {
		// TODO maybe cache as `is_directory`?
		return this._is_directory;
	}
}

export type FsId = Flavored<string, 'FsId'>;

// The `resolve` looks magic and hardcoded - it's matching how `fs` and `fs-extra` resolve paths.
export const to_fs_id = (path: string): FsId => resolve(path);

// TODO extract these? - how do they intersect with Filer types? and smaller interfaces like `PathData`?
export type FsNode = TextFileNode | BinaryFileNode | DirectoryNode;

// TODO should we use `BaseFilerFile` here?
// this mirrors a lot of that, except this models directories as well,
// which we wanted to upstream ..
// so this is a good entrypoint for backporting dirs into the Filer

// TODO names? should they have `Fs` prefix? extract?

export interface BaseNode {
	readonly id: FsId;
	readonly is_directory: boolean;
	readonly encoding: Encoding;
	readonly content: string | Buffer | null;
	// readonly content_buffer: Buffer | null;
	readonly stats: PathStats;
	// readonly path_data: PathData; // TODO currently isn't used - rename? `PathInfo`? `PathMeta`? `Path`?
}
export interface BaseFileNode extends BaseNode {
	readonly is_directory: false;
	readonly content: string | Buffer;
}
export interface TextFileNode extends BaseFileNode {
	readonly encoding: 'utf8';
	readonly content: string;
}
export interface BinaryFileNode extends BaseFileNode {
	readonly encoding: null;
	readonly content: Buffer;
	// readonly content_buffer: Buffer;
}
export interface DirectoryNode extends BaseNode {
	readonly is_directory: true;
	readonly content: null;
	// readonly content_buffer: null;
}
