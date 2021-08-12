import {basename, dirname, join} from 'path';
import {Unreachable_Error} from '@feltcoop/felt/util/error.js';
import {strip_start} from '@feltcoop/felt/util/string.js';

import type {NonBuildableFilerDir, BuildableFilerDir, FilerDir} from 'src/build/filer_dir.js';
import {reconstruct_build_files} from './build_file.js';
import type {BuildFile} from 'src/build/build_file.js';
import type {BaseFilerFile} from 'src/build/filer_file.js';
import {to_hash} from './utils.js';
import type {BuildConfig} from 'src/build/build_config.js';
import type {Encoding} from 'src/fs/encoding.js';
import type {FilerFile} from 'src/build/Filer.js';
import type {SourceMeta} from 'src/build/source_meta.js';
import type {BuildDependency} from 'src/build/build_dependency.js';
import {EXTERNALS_BUILD_DIRNAME} from '../paths.js';
import {is_external_module} from '../utils/module.js';
import type {BuildContext} from 'src/build/builder.js';

export type SourceFile = BuildableSourceFile | NonBuildableSourceFile;
export type BuildableSourceFile = BuildableTextSourceFile | BuildableBinarySourceFile;
export type NonBuildableSourceFile = NonBuildableTextSourceFile | NonBuildableBinarySourceFile;
export interface TextSourceFile extends BaseSourceFile {
	readonly encoding: 'utf8';
	content: string;
}
export interface BinarySourceFile extends BaseSourceFile {
	readonly encoding: null;
	content: Buffer;
	content_buffer: Buffer;
}
export interface BaseSourceFile extends BaseFilerFile {
	readonly type: 'source';
	readonly dir_base_path: string; // TODO is this the best design? if so should it also go on the `BaseFilerFile`? what about `base_path` too?
}
export interface BuildableTextSourceFile extends TextSourceFile, BaseBuildableFile {
	readonly filer_dir: BuildableFilerDir;
}
export interface BuildableBinarySourceFile extends BinarySourceFile, BaseBuildableFile {
	readonly filer_dir: BuildableFilerDir;
}
export interface BaseBuildableFile {
	readonly filer_dir: FilerDir;
	readonly build_files: Map<BuildConfig, readonly BuildFile[]>;
	readonly build_configs: Set<BuildConfig>;
	readonly is_input_to_build_configs: null | Set<BuildConfig>;
	readonly dependencies: Map<BuildConfig, Map<string, Map<string, BuildDependency>>>; // `dependencies` are sets of build ids by source file ids, that this one imports or otherwise depends on (they may point to nonexistent files!)
	readonly dependents: Map<BuildConfig, Map<string, Map<string, BuildDependency>>>; // `dependents` are sets of build ids by buildable source file ids, that import or otherwise depend on this one
	readonly buildable: true;
	dirty: boolean; // will be `true` for source files with hydrated files that need to rebuild (like detected changes since the filer last ran)
}
export interface NonBuildableTextSourceFile extends TextSourceFile, BaseNonBuildableFile {}
export interface NonBuildableBinarySourceFile extends BinarySourceFile, BaseNonBuildableFile {}
export interface BaseNonBuildableFile {
	readonly filer_dir: NonBuildableFilerDir;
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
	content: string | Buffer,
	filer_dir: FilerDir,
	source_meta: SourceMeta | undefined,
	{fs, build_configs}: BuildContext,
): Promise<SourceFile> => {
	let content_buffer: Buffer | undefined = encoding === null ? (content as Buffer) : undefined;
	let content_hash: string | undefined = undefined;
	let reconstructed_build_files: Map<BuildConfig, BuildFile[]> | null = null;
	let dirty = false;
	if (filer_dir.buildable && source_meta !== undefined) {
		// TODO why the source meta guard here for `content_buffer` and `content_hash`?
		if (encoding === 'utf8') {
			content_buffer = Buffer.from(content);
		} else if (encoding !== null) {
			throw new Unreachable_Error(encoding);
		}
		content_hash = to_hash(content_buffer!);

		// TODO not sure if `dirty` flag is the best solution here,
		// or if it should be more widely used?
		dirty = content_hash !== source_meta.data.content_hash;
		reconstructed_build_files = await reconstruct_build_files(fs, source_meta, build_configs!);
	}
	if (is_external_module(id)) {
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
			content: content as string,
			content_buffer,
			content_hash,
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
						content: content as string,
						content_buffer,
						content_hash,
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
						content: content as string,
						content_buffer,
						content_hash,
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
						content: content as Buffer,
						content_buffer: content_buffer as Buffer,
						content_hash,
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
						content: content as Buffer,
						content_buffer: content_buffer as Buffer,
						content_hash,
						filer_dir,
						build_files: null,
						stats: undefined,
						mime_type: undefined,
				  };
		default:
			throw new Unreachable_Error(encoding);
	}
};

export function assert_source_file(file: FilerFile | undefined | null): asserts file is SourceFile {
	if (file == null) {
		throw Error(`Expected a file but got ${file}`);
	}
	if (file.type !== 'source') {
		throw Error(`Expected a source file, but type is ${file.type}: ${file.id}`);
	}
}

export function assert_buildable_source_file(
	file: FilerFile | undefined | null,
): asserts file is BuildableSourceFile {
	assert_source_file(file);
	if (!file.buildable) {
		throw Error(`Expected file to be buildable: ${file.id}`);
	}
}
