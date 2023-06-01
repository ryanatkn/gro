import {resolve} from 'path';
import type {Flavored} from '@feltjs/util/types.js';

import type {Encoding} from './encoding.js';
import type {PathStats} from './pathData.js';
import type {PathFilter} from './filter.js';

// API is modeled after `fs-extra`: https://github.com/jprichardson/node-fs-extra/
export interface Filesystem {
	stat: FsStat;
	exists: FsExists;
	findFiles: FsFindFiles;
	readFile: FsReadFile;
	writeFile: FsWriteFile;
	remove: FsRemove;
	move: FsMove;
	copy: FsCopy;
	readDir: FsReadDir;
	emptyDir: FsEmptyDir;
	ensureDir: FsEnsureDir;
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
	constructor(private readonly _isDirectory: boolean) {}
	isDirectory(): boolean {
		// TODO maybe cache as `isDirectory`?
		return this._isDirectory;
	}
}

export type FsId = Flavored<string, 'FsId'>;

// The `resolve` looks magic and hardcoded - it's matching how `fs` and `fs-extra` resolve paths.
export const toFsId = (path: string): FsId => resolve(path);

// TODO extract these? - how do they intersect with Filer types? and smaller interfaces like `PathData`?
export type FsNode = TextFileNode | BinaryFileNode | DirectoryNode;

// TODO should we use `BaseFilerFile` here?
// this mirrors a lot of that, except this models directories as well,
// which we wanted to upstream ..
// so this is a good entrypoint for backporting dirs into the Filer

// TODO names? should they have `Fs` prefix? extract?

export interface BaseNode {
	readonly id: FsId;
	readonly isDirectory: boolean;
	readonly encoding: Encoding;
	readonly content: string | Buffer | null;
	// readonly contentBuffer: Buffer | null;
	readonly stats: PathStats;
	// readonly pathData: PathData; // TODO currently isn't used - rename? `PathInfo`? `PathMeta`? `Path`?
}
export interface BaseFileNode extends BaseNode {
	readonly isDirectory: false;
	readonly content: string | Buffer;
}
export interface TextFileNode extends BaseFileNode {
	readonly encoding: 'utf8';
	readonly content: string;
}
export interface BinaryFileNode extends BaseFileNode {
	readonly encoding: null;
	readonly content: Buffer;
	// readonly contentBuffer: Buffer;
}
export interface DirectoryNode extends BaseNode {
	readonly isDirectory: true;
	readonly content: null;
	// readonly contentBuffer: null;
}
