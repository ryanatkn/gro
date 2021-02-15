import {basename, dirname} from 'path';

import {
	NonBuildableInternalsFilerDir,
	BuildableInternalsFilerDir,
	ExternalsFilerDir,
	FilerDir,
} from '../build/FilerDir.js';
import {BuildFile, reconstructBuildFiles} from './buildFile.js';
import {BaseFilerFile} from './baseFilerFile.js';
import {toHash} from './utils.js';
import {BuildConfig} from '../config/buildConfig.js';
import {Encoding} from '../fs/encoding.js';
import {CachedSourceInfo} from './Filer.js';
import {UnreachableError} from '../utils/error.js';
import {stripStart} from '../utils/string.js';

export type SourceFile = BuildableSourceFile | NonBuildableSourceFile;
export type BuildableSourceFile =
	| BuildableTextSourceFile
	| BuildableBinarySourceFile
	| BuildableExternalsSourceFile;
export type NonBuildableSourceFile = NonBuildableTextSourceFile | NonBuildableBinarySourceFile;
export interface TextSourceFile extends BaseSourceFile {
	readonly sourceType: 'text';
	readonly encoding: 'utf8';
	contents: string;
}
export interface BinarySourceFile extends BaseSourceFile {
	readonly sourceType: 'binary';
	readonly encoding: null;
	contents: Buffer;
	contentsBuffer: Buffer;
}
export interface ExternalsSourceFile extends BaseSourceFile {
	readonly sourceType: 'externals';
	readonly encoding: 'utf8';
	contents: string;
}
export interface BaseSourceFile extends BaseFilerFile {
	readonly type: 'source';
	readonly dirBasePath: string; // TODO is this the best design? if so should it also go on the `BaseFilerFile`? what about `basePath` too?
}
export interface BuildableTextSourceFile extends TextSourceFile, BaseBuildableFile {
	readonly filerDir: BuildableInternalsFilerDir;
}
export interface BuildableBinarySourceFile extends BinarySourceFile, BaseBuildableFile {
	readonly filerDir: BuildableInternalsFilerDir;
}
export interface BuildableExternalsSourceFile extends ExternalsSourceFile, BaseBuildableFile {
	readonly filerDir: ExternalsFilerDir;
}
export interface BaseBuildableFile {
	readonly buildable: true;
	readonly filerDir: FilerDir;
	readonly buildFiles: Map<BuildConfig, readonly BuildFile[]>;
	readonly buildConfigs: Set<BuildConfig>;
	readonly isInputToBuildConfigs: null | Set<BuildConfig>;
	readonly dependencies: Map<BuildConfig, Set<string>>; // `dependencies` are source file ids that this one imports or otherwise depends on (they may point to nonexistent files!)
	readonly dependents: Map<BuildConfig, Set<BuildableSourceFile>>; // `dependents` are other buildable source files that import or otherwise depend on this one
}
export interface NonBuildableTextSourceFile extends TextSourceFile, BaseNonBuildableFile {}
export interface NonBuildableBinarySourceFile extends BinarySourceFile, BaseNonBuildableFile {}
export interface BaseNonBuildableFile {
	readonly buildable: false;
	readonly filerDir: NonBuildableInternalsFilerDir;
	readonly buildFiles: null;
	readonly buildConfigs: null;
	readonly isInputToBuildConfigs: null;
	readonly dependencies: null;
	readonly dependents: null;
}

export const createSourceFile = async (
	id: string,
	encoding: Encoding,
	extension: string,
	contents: string | Buffer,
	filerDir: FilerDir,
	cachedSourceInfo: CachedSourceInfo | undefined,
	buildConfigs: BuildConfig[] | null,
	externalsBuildConfig: BuildConfig | null,
): Promise<SourceFile> => {
	let contentsBuffer: Buffer | undefined = encoding === null ? (contents as Buffer) : undefined;
	let contentsHash: string | undefined = undefined;
	let reconstructedBuildFiles: Map<BuildConfig, BuildFile[]> | null = null;
	if (filerDir.buildable && cachedSourceInfo !== undefined) {
		if (encoding === 'utf8') {
			contentsBuffer = Buffer.from(contents);
		} else if (encoding !== null) {
			throw new UnreachableError(encoding);
		}
		contentsHash = toHash(contentsBuffer!);
		if (contentsHash === cachedSourceInfo.data.contentsHash) {
			if (filerDir.type === 'externals') console.log('reconstructing id', id);
			reconstructedBuildFiles = await reconstructBuildFiles(cachedSourceInfo, buildConfigs!);
		}
	}
	if (filerDir.type === 'externals') {
		if (encoding !== 'utf8') {
			throw Error(`Externals sources must have utf8 encoding, not '${encoding}': ${id}`);
		}
		if (externalsBuildConfig === null) {
			throw Error(`Cannot create externals source file without a build config.`);
		}
		let filename = basename(id) + (id.endsWith(extension) ? '' : extension);
		const dir = `${filerDir.dir}/${dirname(id)}/`; // TODO the slash is currently needed because paths.sourceId and the rest have a trailing slash, but this may cause other problems
		const dirBasePath = stripStart(dir, filerDir.dir + '/'); // TODO see above comment about `+ '/'`
		console.log('createSourceFile', id);
		debugger;
		return {
			type: 'source',
			sourceType: 'externals',
			buildable: true,
			buildConfigs: new Set([externalsBuildConfig]),
			isInputToBuildConfigs: null,
			dependencies: new Map(),
			dependents: new Map(),
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
						sourceType: 'text',
						buildConfigs: new Set(),
						isInputToBuildConfigs: null,
						dependencies: new Map(),
						dependents: new Map(),
						buildable: true,
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
						sourceType: 'text',
						buildConfigs: null,
						isInputToBuildConfigs: null,
						dependencies: null,
						dependents: null,
						buildable: false,
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
						sourceType: 'binary',
						buildConfigs: new Set(),
						isInputToBuildConfigs: null,
						dependencies: new Map(),
						dependents: new Map(),
						buildable: true,
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
						sourceType: 'binary',
						buildConfigs: null,
						isInputToBuildConfigs: null,
						dependencies: null,
						dependents: null,
						buildable: false,
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
