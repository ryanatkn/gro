import {basename, dirname, join} from 'path';

import {NonBuildableFilerDir, BuildableFilerDir, FilerDir} from '../build/FilerDir.js';
import {BuildFile, reconstructBuildFiles} from './buildFile.js';
import {BaseFilerFile} from './baseFilerFile.js';
import {toHash} from './utils.js';
import {BuildConfig} from '../config/buildConfig.js';
import {Encoding} from '../fs/encoding.js';
import type {CachedSourceInfo, FilerFile} from './Filer.js';
import {UnreachableError} from '../utils/error.js';
import {stripStart} from '../utils/string.js';
import {EXTERNALS_BUILD_DIR} from '../paths.js';
import {isExternalBrowserModule} from '../utils/module.js';

export type SourceFile = BuildableSourceFile | NonBuildableSourceFile;
export type BuildableSourceFile =
	| BuildableTextSourceFile
	| BuildableBinarySourceFile
	| BuildableExternalsSourceFile;
export type NonBuildableSourceFile = NonBuildableTextSourceFile | NonBuildableBinarySourceFile;
export interface TextSourceFile extends BaseSourceFile {
	readonly external: false;
	readonly encoding: 'utf8';
	contents: string;
}
export interface BinarySourceFile extends BaseSourceFile {
	readonly external: false;
	readonly encoding: null;
	contents: Buffer;
	contentsBuffer: Buffer;
}
export interface ExternalsSourceFile extends BaseSourceFile {
	readonly external: true;
	readonly encoding: 'utf8';
	contents: string;
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
export interface BuildableExternalsSourceFile extends ExternalsSourceFile, BaseBuildableFile {
	readonly filerDir: BuildableFilerDir;
}
export interface BaseBuildableFile {
	readonly filerDir: FilerDir;
	readonly buildFiles: Map<BuildConfig, readonly BuildFile[]>;
	readonly buildConfigs: Set<BuildConfig>;
	readonly isInputToBuildConfigs: null | Set<BuildConfig>;
	readonly dependencies: Map<BuildConfig, Set<string>>; // `dependencies` are source file ids that this one imports or otherwise depends on (they may point to nonexistent files!)
	readonly dependents: Map<BuildConfig, Set<BuildableSourceFile>>; // `dependents` are other buildable source files that import or otherwise depend on this one
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
	contents: string | Buffer,
	filerDir: FilerDir,
	cachedSourceInfo: CachedSourceInfo | undefined,
	buildConfigs: BuildConfig[] | null,
): Promise<SourceFile> => {
	let contentsBuffer: Buffer | undefined = encoding === null ? (contents as Buffer) : undefined;
	let contentsHash: string | undefined = undefined;
	let reconstructedBuildFiles: Map<BuildConfig, BuildFile[]> | null = null;
	let dirty = false;
	if (filerDir.buildable && cachedSourceInfo !== undefined) {
		// TODO why the cached source info guard here for `contentsBuffer` and `contentsHash`?
		if (encoding === 'utf8') {
			contentsBuffer = Buffer.from(contents);
		} else if (encoding !== null) {
			throw new UnreachableError(encoding);
		}
		contentsHash = toHash(contentsBuffer!);

		// TODO not sure if `dirty` flag is the best solution here,
		// or if it should be more widely used?
		dirty = contentsHash !== cachedSourceInfo.data.contentsHash;
		reconstructedBuildFiles = await reconstructBuildFiles(cachedSourceInfo, buildConfigs!);
	}
	if (isExternalBrowserModule(id)) {
		// externals
		if (encoding !== 'utf8') {
			throw Error(`Externals sources must have utf8 encoding, not '${encoding}': ${id}`);
		}
		if (!filerDir.buildable) {
			throw Error(`Expected filer dir to be buildable: ${filerDir.dir} - ${id}`);
		}
		let filename = basename(id) + (id.endsWith(extension) ? '' : extension);
		const dir = join(filerDir.dir, EXTERNALS_BUILD_DIR, dirname(id)) + '/'; // TODO the slash is currently needed because paths.sourceId and the rest have a trailing slash, but this may cause other problems
		const dirBasePath = stripStart(dir, filerDir.dir + '/'); // TODO see above comment about `+ '/'`
		return {
			type: 'source',
			external: true,
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
	const dir = dirname(id) + '/'; // TODO the slash is currently needed because paths.sourceId and the rest have a trailing slash, but this may cause other problems
	const dirBasePath = stripStart(dir, filerDir.dir + '/'); // TODO see above comment about `+ '/'`
	switch (encoding) {
		case 'utf8':
			return filerDir.buildable
				? {
						type: 'source',
						external: false,
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
						external: false,
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
						external: false,
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
						external: false,
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
						contents: contents as Buffer,
						contentsBuffer: contentsBuffer as Buffer,
						contentsHash,
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

export function assertBuildableExternalsSourceFile(
	file: FilerFile | undefined | null,
): asserts file is BuildableExternalsSourceFile {
	assertBuildableSourceFile(file);
	if (!file.external) {
		throw Error(`Expected an external file: ${file.id}`);
	}
}
