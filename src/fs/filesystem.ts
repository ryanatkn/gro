import {resolve} from 'path';
import type {Flavored} from '@feltcoop/felt/util/types.js';

import type {Encoding} from './encoding.js';
import type {Path_Stats} from './path_data.js';
import type {Path_Filter} from './path_filter.js';

// API is modeled after `fs-extra`: https://github.com/jprichardson/node-fs-extra/
export interface Filesystem {
	stat: Fs_Stat;
	exists: Fs_Exists;
	find_files: Fs_Find_Files;
	read_file: Fs_Read_File;
	write_file: Fs_Write_File;
	remove: Fs_Remove;
	move: Fs_Move;
	copy: Fs_Copy;
	read_dir: Fs_Read_Dir;
	empty_dir: Fs_Empty_Dir;
	ensure_dir: Fs_Ensure_Dir;
}

export interface Fs_Stat {
	(path: string): Promise<Path_Stats>;
}
export interface Fs_Exists {
	(path: string): Promise<boolean>;
}
export interface Fs_Find_Files {
	(
		dir: string,
		filter?: Path_Filter,
		// pass `null` to speed things up at the risk of infrequent misorderings (at least on Linux)
		sort?: ((a: [any, any], b: [any, any]) => number) | null,
	): Promise<Map<string, Path_Stats>>;
}
export interface Fs_Read_File {
	(path: string): Promise<Buffer>;
	(path: string, encoding: 'utf8'): Promise<string>;
	(path: string, encoding: null): Promise<Buffer>;
	(path: string, encoding?: Encoding): Promise<Buffer | string>;
}
export interface Fs_Write_File {
	(path: string, data: any, encoding?: Encoding): Promise<void>;
}
export interface Fs_Remove {
	(path: string): Promise<void>;
}
export interface Fs_Move {
	(src: string, dest: string, options?: Fs_Move_Options): Promise<void>; // TODO which options?
}
export interface Fs_Copy {
	(src: string, dest: string, options?: Fs_Copy_Options): Promise<void>; // TODO which options? all? breaks conventionn with above
}
export interface Fs_Read_Dir {
	(path: string): Promise<string[]>;
}
export interface Fs_Empty_Dir {
	(path: string): Promise<void>;
}
export interface Fs_Ensure_Dir {
	(path: string): Promise<void>;
}

// TODO try to implement some of these
export interface Fs_Copy_Options {
	// dereference?: boolean;
	overwrite?: boolean; // defaults to `true`
	// preserveTimestamps?: boolean;
	// errorOnExist?: boolean; // TODO implement this
	filter?: Fs_Copy_Filter_Sync | Fs_Copy_Filter_Async;
	// recursive?: boolean;
}
export interface Fs_Move_Options {
	overwrite?: boolean;
	limit?: number;
}
export type Fs_Copy_Filter_Sync = (src: string, dest: string) => boolean;
export type Fs_Copy_Filter_Async = (src: string, dest: string) => Promise<boolean>;

export class Fs_Stats implements Path_Stats {
	constructor(private readonly _is_directory: boolean) {}
	isDirectory() {
		return this._is_directory;
	}
}

export type Fs_Id = Flavored<string, 'Fs_Id'>;

// The `resolve` looks magic and hardcoded - it's matching how `fs` and `fs-extra` resolve paths.
export const to_fs_id = (path: string): Fs_Id => resolve(path);

// TODO extract these? - how do they intersect with Filer types? and smaller interfaces like `Path_Data`?
export type Fs_Node = Text_File_Node | Binary_File_Node | Directory_Node;

// TODO should we use `Base_Filer_File` here?
// this mirrors a lot of that, except this models directories as well,
// which we wanted to upstream ..
// so this is a good entrypoint for backporting dirs into the Filer

// TODO names? should they have `Fs` prefix? extract?

export interface Base_Node {
	readonly id: Fs_Id;
	readonly is_directory: boolean;
	readonly encoding: Encoding;
	readonly contents: string | Buffer | null;
	// readonly contents_buffer: Buffer | null;
	readonly stats: Path_Stats;
	// readonly path_data: Path_Data; // TODO currently isn't used - rename? `PathInfo`? `PathMeta`? `Path`?
}
export interface BaseFileNode extends Base_Node {
	readonly is_directory: false;
	readonly contents: string | Buffer;
}
export interface Text_File_Node extends BaseFileNode {
	readonly encoding: 'utf8';
	readonly contents: string;
}
export interface Binary_File_Node extends BaseFileNode {
	readonly encoding: null;
	readonly contents: Buffer;
	// readonly contents_buffer: Buffer;
}
export interface Directory_Node extends Base_Node {
	readonly is_directory: true;
	readonly contents: null;
	// readonly contents_buffer: null;
}
