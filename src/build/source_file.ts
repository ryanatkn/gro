import {basename, dirname, join} from 'path';
import {Unreachable_Error} from '@feltcoop/felt/utils/error.js';
import {strip_start} from '@feltcoop/felt/utils/string.js';

import type {NonBuildableFilerDir, BuildableFilerDir, FilerDir} from '../build/filerDir.js';
import {reconstructBuildFiles} from './buildFile.js';
import type {BuildFile} from './buildFile.js';
import type {BaseFilerFile} from './baseFilerFile.js';
import {toHash} from './utils.js';
import type {Build_Config} from '../build/build_config.js';
import type {Encoding} from '../fs/encoding.js';
import type {FilerFile} from './Filer.js';
import type {SourceMeta} from './source_meta.js';
import {EXTERNALS_BUILD_DIRNAME} from '../paths.js';
import {isExternalBrowserModule} from '../utils/module.js';
import type {BuildContext, BuildDependency} from './builder.js';

export type SourceFile = BuildableSourceFile | NonBuildableSourceFile;
export type BuildableSourceFile = BuildableTextSourceFile | BuildableBinarySourceFile;
export type NonBuildableSourceFile = NonBuildableTextSourceFile | NonBuildableBinarySourceFile;
export interface TextSourceFile extends BaseSourceFile {
	readonly encoding: 'utf8';
	contents: string;
}
export interface BinarySourceFile extends BaseSourceFile {
	readonly encoding: null;
	contents: Buffer;
	contentsBuffer: Buffer;
}
export interface BaseSourceFile extends BaseFilerFile {
	readonly type: 'source';
	readonly dir_base_path: string; // TODO is this the best design? if so should it also go on the `BaseFilerFile`? what about `base_path` too?
}
export interface BuildableTextSourceFile extends TextSourceFile, BaseBuildableFile {
	readonly filerDir: BuildableFilerDir;
}
export interface BuildableBinarySourceFile extends BinarySourceFile, BaseBuildableFile {
	readonly filerDir: BuildableFilerDir;
}
export interface BaseBuildableFile {
	readonly filerDir: FilerDir;
	readonly buildFiles: Map<Build_Config, readonly BuildFile[]>;
	readonly build_configs: Set<Build_Config>;
	readonly is_input_to_build_configs: null | Set<Build_Config>;
	readonly dependencies: Map<Build_Config, Map<string, Map<string, BuildDependency>>>; // `dependencies` are sets of build ids by source file ids, that this one imports or otherwise depends on (they may point to nonexistent files!)
	readonly dependents: Map<Build_Config, Map<string, Map<string, BuildDependency>>>; // `dependents` are sets of build ids by buildable source file ids, that import or otherwise depend on this one
	readonly buildable: true;
	dirty: boolean; // will be `true` for source files with hydrated files that need to rebuild (like detected changes since the filer last ran)
}
export interface NonBuildableTextSourceFile extends TextSourceFile, BaseNonBuildableFile {}
export interface NonBuildableBinarySourceFile extends BinarySourceFile, BaseNonBuildableFile {}
export interface BaseNonBuildableFile {
	readonly filerDir: NonBuildableFilerDir;
	readonly buildFiles: null;
	readonly build_configs: null;
	readonly is_input_to_build_configs: null;
	readonly dependencies: null;
	readonly dependents: null;
	readonly buildable: false;
	readonly dirty: false;
}

export const createSourceFile = async (
	id: string,
	encoding: Encoding,
	extension: string,
	contents: string | Buffer,
	filerDir: FilerDir,
	source_meta: SourceMeta | undefined,
	{fs, build_configs}: BuildContext,
): Promise<SourceFile> => {
	let contentsBuffer: Buffer | undefined = encoding === null ? (contents as Buffer) : undefined;
	let contentsHash: string | undefined = undefined;
	let reconstructedBuildFiles: Map<Build_Config, BuildFile[]> | null = null;
	let dirty = false;
	if (filerDir.buildable && source_meta !== undefined) {
		// TODO why the source meta guard here for `contentsBuffer` and `contentsHash`?
		if (encoding === 'utf8') {
			contentsBuffer = Buffer.from(contents);
		} else if (encoding !== null) {
			throw new Unreachable_Error(encoding);
		}
		contentsHash = toHash(contentsBuffer!);

		// TODO not sure if `dirty` flag is the best solution here,
		// or if it should be more widely used?
		dirty = contentsHash !== source_meta.data.contentsHash;
		reconstructedBuildFiles = await reconstructBuildFiles(fs, source_meta, build_configs!);
	}
	if (isExternalBrowserModule(id)) {
		// externals
		if (encoding !== 'utf8') {
			throw Error(`Externals sources must have utf8 encoding, not '${encoding}': ${id}`);
		}
		if (!filerDir.buildable) {
			throw Error(`Expected filer dir to be buildable: ${filerDir.dir} - ${id}`);
		}
		let filename = 'index' + (id.endsWith(extension) ? '' : extension);
		const dir = join(filerDir.dir, EXTERNALS_BUILD_DIRNAME, dirname(id)) + '/'; // TODO the slash is currently needed because paths.source_id and the rest have a trailing slash, but this may cause other problems
		const dir_base_path = strip_start(dir, filerDir.dir + '/'); // TODO see above comment about `+ '/'`
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
			contentsBuffer,
			contentsHash,
			filerDir,
			buildFiles: reconstructedBuildFiles || new Map(),
			stats: undefined,
			mimeType: undefined,
		};
	}
	const filename = basename(id);
	const dir = dirname(id) + '/'; // TODO the slash is currently needed because paths.source_id and the rest have a trailing slash, but this may cause other problems
	const dir_base_path = strip_start(dir, filerDir.dir + '/'); // TODO see above comment about `+ '/'`
	switch (encoding) {
		case 'utf8':
			return filerDir.buildable
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
						contentsBuffer,
						contentsHash,
						filerDir,
						buildFiles: reconstructedBuildFiles || new Map(),
						stats: undefined,
						mimeType: undefined,
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
						contentsBuffer,
						contentsHash,
						filerDir,
						buildFiles: null,
						stats: undefined,
						mimeType: undefined,
				  };
		case null:
			return filerDir.buildable
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
						contentsBuffer: contentsBuffer as Buffer,
						contentsHash,
						filerDir,
						buildFiles: reconstructedBuildFiles || new Map(),
						stats: undefined,
						mimeType: undefined,
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
						contentsBuffer: contentsBuffer as Buffer,
						contentsHash,
						filerDir,
						buildFiles: null,
						stats: undefined,
						mimeType: undefined,
				  };
		default:
			throw new Unreachable_Error(encoding);
	}
};

export function assertSourceFile(file: FilerFile | undefined | null): asserts file is SourceFile {
	if (file == null) {
		throw Error(`Expected a file but got ${file}`);
	}
	if (file.type !== 'source') {
		throw Error(`Expected a source file, but type is ${file.type}: ${file.id}`);
	}
}

export function assertBuildableSourceFile(
	file: FilerFile | undefined | null,
): asserts file is BuildableSourceFile {
	assertSourceFile(file);
	if (!file.buildable) {
		throw Error(`Expected file to be buildable: ${file.id}`);
	}
}
