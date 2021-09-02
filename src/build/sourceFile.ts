import {basename, dirname, join} from 'path';
import {UnreachableError} from '@feltcoop/felt/util/error.js';
import {stripStart} from '@feltcoop/felt/util/string.js';

import type {NonBuildableFilerDir, BuildableFilerDir, FilerDir} from 'src/build/filerDir.js';
import {reconstructBuildFiles} from './buildFile.js';
import type {BuildFile} from 'src/build/buildFile.js';
import type {BaseFilerFile} from 'src/build/filerFile.js';
import {toHash} from './utils.js';
import type {BuildConfig} from 'src/build/buildConfig.js';
import type {Encoding} from 'src/fs/encoding.js';
import type {FilerFile} from 'src/build/Filer.js';
import type {SourceMeta} from 'src/build/sourceMeta.js';
import type {BuildDependency} from 'src/build/buildDependency.js';
import {EXTERNALS_BUILD_DIRNAME} from '../paths.js';
import {isExternalModule} from '../utils/module.js';
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
	contentBuffer: Buffer;
}
export interface BaseSourceFile extends BaseFilerFile {
	readonly type: 'source';
	readonly dirBasePath: string; // TODO is this the best design? if so should it also go on the `BaseFilerFile`? what about `basePath` too?
}
export interface BuildableTextSourceFile extends TextSourceFile, BaseBuildableFile {
	readonly filerDir: BuildableFilerDir;
}
export interface BuildableBinarySourceFile extends BinarySourceFile, BaseBuildableFile {
	readonly filerDir: BuildableFilerDir;
}
export interface BaseBuildableFile {
	readonly filerDir: FilerDir;
	readonly buildFiles: Map<BuildConfig, readonly BuildFile[]>;
	readonly buildConfigs: Set<BuildConfig>;
	readonly isInputToBuildConfigs: null | Set<BuildConfig>;
	readonly dependencies: Map<BuildConfig, Map<string, Map<string, BuildDependency>>>; // `dependencies` are sets of build ids by source file ids, that this one imports or otherwise depends on (they may point to nonexistent files!)
	readonly dependents: Map<BuildConfig, Map<string, Map<string, BuildDependency>>>; // `dependents` are sets of build ids by buildable source file ids, that import or otherwise depend on this one
	readonly buildable: true;
	dirty: boolean; // will be `true` for source files with hydrated files that need to rebuild (like detected changes since the filer last ran)
}
export interface NonBuildableTextSourceFile extends TextSourceFile, BaseNonBuildableFile {}
export interface NonBuildableBinarySourceFile extends BinarySourceFile, BaseNonBuildableFile {}
export interface BaseNonBuildableFile {
	readonly filerDir: NonBuildableFilerDir;
	readonly buildFiles: null;
	readonly buildConfigs: null;
	readonly isInputToBuildConfigs: null;
	readonly dependencies: null;
	readonly dependents: null;
	readonly buildable: false;
	readonly dirty: false;
}

export const createSourceFile = async (
	id: string,
	encoding: Encoding,
	extension: string,
	content: string | Buffer,
	filerDir: FilerDir,
	sourceMeta: SourceMeta | undefined,
	{fs, buildConfigs}: BuildContext,
): Promise<SourceFile> => {
	let contentBuffer: Buffer | undefined = encoding === null ? (content as Buffer) : undefined;
	let contentHash: string | undefined = undefined;
	let reconstructedBuildFiles: Map<BuildConfig, BuildFile[]> | null = null;
	let dirty = false;
	if (filerDir.buildable && sourceMeta !== undefined) {
		// TODO why the source meta guard here for `contentBuffer` and `contentHash`?
		if (encoding === 'utf8') {
			contentBuffer = Buffer.from(content);
		} else if (encoding !== null) {
			throw new UnreachableError(encoding);
		}
		contentHash = toHash(contentBuffer!);

		// TODO not sure if `dirty` flag is the best solution here,
		// or if it should be more widely used?
		dirty = contentHash !== sourceMeta.data.contentHash;
		reconstructedBuildFiles = await reconstructBuildFiles(fs, sourceMeta, buildConfigs!);
	}
	if (isExternalModule(id)) {
		// externals
		if (encoding !== 'utf8') {
			throw Error(`Externals sources must have utf8 encoding, not '${encoding}': ${id}`);
		}
		if (!filerDir.buildable) {
			throw Error(`Expected filer dir to be buildable: ${filerDir.dir} - ${id}`);
		}
		let filename = 'index' + (id.endsWith(extension) ? '' : extension);
		const dir = join(filerDir.dir, EXTERNALS_BUILD_DIRNAME, dirname(id)) + '/'; // TODO the slash is currently needed because paths.sourceId and the rest have a trailing slash, but this may cause other problems
		const dirBasePath = stripStart(dir, filerDir.dir + '/'); // TODO see above comment about `+ '/'`
		return {
			type: 'source',
			buildConfigs: new Set(),
			isInputToBuildConfigs: null,
			dependencies: new Map(),
			dependents: new Map(),
			buildable: true,
			dirty,
			id,
			filename,
			dir,
			dirBasePath,
			extension,
			encoding,
			content: content as string,
			contentBuffer,
			contentHash,
			filerDir,
			buildFiles: reconstructedBuildFiles || new Map(),
			stats: undefined,
			mimeType: undefined,
		};
	}
	const filename = basename(id);
	const dir = dirname(id) + '/'; // TODO the slash is currently needed because paths.sourceId and the rest have a trailing slash, but this may cause other problems
	const dirBasePath = stripStart(dir, filerDir.dir + '/'); // TODO see above comment about `+ '/'`
	switch (encoding) {
		case 'utf8':
			return filerDir.buildable
				? {
						type: 'source',
						buildConfigs: new Set(),
						isInputToBuildConfigs: null,
						dependencies: new Map(),
						dependents: new Map(),
						buildable: true,
						dirty,
						id,
						filename,
						dir,
						dirBasePath,
						extension,
						encoding,
						content: content as string,
						contentBuffer,
						contentHash,
						filerDir,
						buildFiles: reconstructedBuildFiles || new Map(),
						stats: undefined,
						mimeType: undefined,
				  }
				: {
						type: 'source',
						buildConfigs: null,
						isInputToBuildConfigs: null,
						dependencies: null,
						dependents: null,
						buildable: false,
						dirty: false,
						id,
						filename,
						dir,
						dirBasePath,
						extension,
						encoding,
						content: content as string,
						contentBuffer,
						contentHash,
						filerDir,
						buildFiles: null,
						stats: undefined,
						mimeType: undefined,
				  };
		case null:
			return filerDir.buildable
				? {
						type: 'source',
						buildConfigs: new Set(),
						isInputToBuildConfigs: null,
						dependencies: new Map(),
						dependents: new Map(),
						buildable: true,
						dirty,
						id,
						filename,
						dir,
						dirBasePath,
						extension,
						encoding,
						content: content as Buffer,
						contentBuffer: contentBuffer as Buffer,
						contentHash,
						filerDir,
						buildFiles: reconstructedBuildFiles || new Map(),
						stats: undefined,
						mimeType: undefined,
				  }
				: {
						type: 'source',
						buildConfigs: null,
						isInputToBuildConfigs: null,
						dependencies: null,
						dependents: null,
						buildable: false,
						dirty: false,
						id,
						filename,
						dir,
						dirBasePath,
						extension,
						encoding,
						content: content as Buffer,
						contentBuffer: contentBuffer as Buffer,
						contentHash,
						filerDir,
						buildFiles: null,
						stats: undefined,
						mimeType: undefined,
				  };
		default:
			throw new UnreachableError(encoding);
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
