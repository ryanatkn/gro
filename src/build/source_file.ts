import {basename, dirname, join} from 'path';
import {Unreachable_Error} from '@feltcoop/felt/utils/error.js';
import {strip_start} from '@feltcoop/felt/utils/string.js';

import type {Non_Buildable_Filer_Dir, Buildable_Filer_Dir, Filer_Dir} from '../build/filer_dir.js';
import {reconstructBuild_Files} from './build_file.js';
import type {Build_File} from './build_file.js';
import type {Base_Filer_File} from './base_filer_file.js';
import {to_hash} from './utils.js';
import type {Build_Config} from '../build/build_config.js';
import type {Encoding} from '../fs/encoding.js';
import type {Filer_File} from './Filer.js';
import type {Source_Meta} from './source_meta.js';
import {EXTERNALS_BUILD_DIRNAME} from '../paths.js';
import {is_external_browser_module} from '../utils/module.js';
import type {Build_Context, Build_Dependency} from './builder.js';

export type Source_File = Buildable_Source_File | Non_Buildable_Source_File;
export type Buildable_Source_File = Buildable_Text_Source_File | Buildable_Binary_Source_File;
export type Non_Buildable_Source_File =
	| Non_Buildable_Text_Source_File
	| Non_Buildable_Binary_Source_File;
export interface Text_Source_File extends BaseSource_File {
	readonly encoding: 'utf8';
	contents: string;
}
export interface Binary_Source_File extends BaseSource_File {
	readonly encoding: null;
	contents: Buffer;
	contents_buffer: Buffer;
}
export interface BaseSource_File extends Base_Filer_File {
	readonly type: 'source';
	readonly dir_base_path: string; // TODO is this the best design? if so should it also go on the `Base_Filer_File`? what about `base_path` too?
}
export interface Buildable_Text_Source_File extends Text_Source_File, Base_Buildable_File {
	readonly filer_dir: Buildable_Filer_Dir;
}
export interface Buildable_Binary_Source_File extends Binary_Source_File, Base_Buildable_File {
	readonly filer_dir: Buildable_Filer_Dir;
}
export interface Base_Buildable_File {
	readonly filer_dir: Filer_Dir;
	readonly build_files: Map<Build_Config, readonly Build_File[]>;
	readonly build_configs: Set<Build_Config>;
	readonly is_input_to_build_configs: null | Set<Build_Config>;
	readonly dependencies: Map<Build_Config, Map<string, Map<string, Build_Dependency>>>; // `dependencies` are sets of build ids by source file ids, that this one imports or otherwise depends on (they may point to nonexistent files!)
	readonly dependents: Map<Build_Config, Map<string, Map<string, Build_Dependency>>>; // `dependents` are sets of build ids by buildable source file ids, that import or otherwise depend on this one
	readonly buildable: true;
	dirty: boolean; // will be `true` for source files with hydrated files that need to rebuild (like detected changes since the filer last ran)
}
export interface Non_Buildable_Text_Source_File extends Text_Source_File, Base_Non_Buildable_File {}
export interface Non_Buildable_Binary_Source_File
	extends Binary_Source_File,
		Base_Non_Buildable_File {}
export interface Base_Non_Buildable_File {
	readonly filer_dir: Non_Buildable_Filer_Dir;
	readonly build_files: null;
	readonly build_configs: null;
	readonly is_input_to_build_configs: null;
	readonly dependencies: null;
	readonly dependents: null;
	readonly buildable: false;
	readonly dirty: false;
}

export const create_source_file = async (
	id: string,
	encoding: Encoding,
	extension: string,
	contents: string | Buffer,
	filer_dir: Filer_Dir,
	source_meta: Source_Meta | undefined,
	{fs, build_configs}: Build_Context,
): Promise<Source_File> => {
	let contents_buffer: Buffer | undefined = encoding === null ? (contents as Buffer) : undefined;
	let contents_hash: string | undefined = undefined;
	let reconstructed_build_files: Map<Build_Config, Build_File[]> | null = null;
	let dirty = false;
	if (filer_dir.buildable && source_meta !== undefined) {
		// TODO why the source meta guard here for `contents_buffer` and `contents_hash`?
		if (encoding === 'utf8') {
			contents_buffer = Buffer.from(contents);
		} else if (encoding !== null) {
			throw new Unreachable_Error(encoding);
		}
		contents_hash = to_hash(contents_buffer!);

		// TODO not sure if `dirty` flag is the best solution here,
		// or if it should be more widely used?
		dirty = contents_hash !== source_meta.data.contents_hash;
		reconstructed_build_files = await reconstructBuild_Files(fs, source_meta, build_configs!);
	}
	if (is_external_browser_module(id)) {
		// externals
		if (encoding !== 'utf8') {
			throw Error(`Externals sources must have utf8 encoding, not '${encoding}': ${id}`);
		}
		if (!filer_dir.buildable) {
			throw Error(`Expected filer dir to be buildable: ${filer_dir.dir} - ${id}`);
		}
		let filename = 'index' + (id.endsWith(extension) ? '' : extension);
		const dir = join(filer_dir.dir, EXTERNALS_BUILD_DIRNAME, dirname(id)) + '/'; // TODO the slash is currently needed because paths.source_id and the rest have a trailing slash, but this may cause other problems
		const dir_base_path = strip_start(dir, filer_dir.dir + '/'); // TODO see above comment about `+ '/'`
		return {
			type: 'source',
			build_configs: new Set(),
			is_input_to_build_configs: null,
			dependencies: new Map(),
			dependents: new Map(),
			buildable: true,
			dirty,
			id,
			filename,
			dir,
			dir_base_path,
			extension,
			encoding,
			contents: contents as string,
			contents_buffer,
			contents_hash,
			filer_dir,
			build_files: reconstructed_build_files || new Map(),
			stats: undefined,
			mime_type: undefined,
		};
	}
	const filename = basename(id);
	const dir = dirname(id) + '/'; // TODO the slash is currently needed because paths.source_id and the rest have a trailing slash, but this may cause other problems
	const dir_base_path = strip_start(dir, filer_dir.dir + '/'); // TODO see above comment about `+ '/'`
	switch (encoding) {
		case 'utf8':
			return filer_dir.buildable
				? {
						type: 'source',
						build_configs: new Set(),
						is_input_to_build_configs: null,
						dependencies: new Map(),
						dependents: new Map(),
						buildable: true,
						dirty,
						id,
						filename,
						dir,
						dir_base_path,
						extension,
						encoding,
						contents: contents as string,
						contents_buffer,
						contents_hash,
						filer_dir,
						build_files: reconstructed_build_files || new Map(),
						stats: undefined,
						mime_type: undefined,
				  }
				: {
						type: 'source',
						build_configs: null,
						is_input_to_build_configs: null,
						dependencies: null,
						dependents: null,
						buildable: false,
						dirty: false,
						id,
						filename,
						dir,
						dir_base_path,
						extension,
						encoding,
						contents: contents as string,
						contents_buffer,
						contents_hash,
						filer_dir,
						build_files: null,
						stats: undefined,
						mime_type: undefined,
				  };
		case null:
			return filer_dir.buildable
				? {
						type: 'source',
						build_configs: new Set(),
						is_input_to_build_configs: null,
						dependencies: new Map(),
						dependents: new Map(),
						buildable: true,
						dirty,
						id,
						filename,
						dir,
						dir_base_path,
						extension,
						encoding,
						contents: contents as Buffer,
						contents_buffer: contents_buffer as Buffer,
						contents_hash,
						filer_dir,
						build_files: reconstructed_build_files || new Map(),
						stats: undefined,
						mime_type: undefined,
				  }
				: {
						type: 'source',
						build_configs: null,
						is_input_to_build_configs: null,
						dependencies: null,
						dependents: null,
						buildable: false,
						dirty: false,
						id,
						filename,
						dir,
						dir_base_path,
						extension,
						encoding,
						contents: contents as Buffer,
						contents_buffer: contents_buffer as Buffer,
						contents_hash,
						filer_dir,
						build_files: null,
						stats: undefined,
						mime_type: undefined,
				  };
		default:
			throw new Unreachable_Error(encoding);
	}
};

export function assert_source_file(
	file: Filer_File | undefined | null,
): asserts file is Source_File {
	if (file == null) {
		throw Error(`Expected a file but got ${file}`);
	}
	if (file.type !== 'source') {
		throw Error(`Expected a source file, but type is ${file.type}: ${file.id}`);
	}
}

export function assertBuildable_Source_File(
	file: Filer_File | undefined | null,
): asserts file is Buildable_Source_File {
	assert_source_file(file);
	if (!file.buildable) {
		throw Error(`Expected file to be buildable: ${file.id}`);
	}
}
