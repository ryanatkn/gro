import {basename, dirname} from 'path';

import {
	NonBuildableInternalsFilerDir,
	BuildableInternalsFilerDir,
	ExternalsFilerDir,
	FilerDir,
} from '../build/FilerDir.js';
import {BuildFile, reconstructBuildFiles} from './buildFile.js';
import {BaseFilerFile, toHash} from './baseFilerFile.js';
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
	readonly contents: string;
}
export interface BinarySourceFile extends BaseSourceFile {
	readonly sourceType: 'binary';
	readonly encoding: null;
	readonly contents: Buffer;
	readonly contentsBuffer: Buffer;
}
export interface ExternalsSourceFile extends BaseSourceFile {
	readonly sourceType: 'externals';
	readonly encoding: 'utf8';
	readonly contents: string;
}
interface BaseSourceFile extends BaseFilerFile {
	readonly type: 'source';
	readonly dirBasePath: string; // TODO is this the best design? if so should it also go on the `BaseFilerFile`? what about `basePath` too?
}
export interface BuildableTextSourceFile extends TextSourceFile {
	readonly buildable: true;
	readonly filerDir: BuildableInternalsFilerDir;
	readonly compiledFiles: BuildFile[];
	readonly buildConfigs: BuildConfig[];
}
export interface BuildableBinarySourceFile extends BinarySourceFile {
	readonly buildable: true;
	readonly filerDir: BuildableInternalsFilerDir;
	readonly compiledFiles: BuildFile[];
	readonly buildConfigs: BuildConfig[];
}
export interface BuildableExternalsSourceFile extends ExternalsSourceFile {
	readonly buildable: true;
	readonly filerDir: ExternalsFilerDir;
	readonly compiledFiles: BuildFile[];
	readonly buildConfigs: BuildConfig[];
}
export interface NonBuildableTextSourceFile extends TextSourceFile {
	readonly buildable: false;
	readonly filerDir: NonBuildableInternalsFilerDir;
	readonly compiledFiles: null;
	readonly buildConfigs: null;
}
export interface NonBuildableBinarySourceFile extends BinarySourceFile {
	readonly buildable: false;
	readonly filerDir: NonBuildableInternalsFilerDir;
	readonly compiledFiles: null;
	readonly buildConfigs: null;
}

export const createSourceFile = async (
	id: string,
	encoding: Encoding,
	extension: string,
	contents: string | Buffer,
	filerDir: FilerDir,
	cachedSourceInfo: CachedSourceInfo | undefined,
): Promise<SourceFile> => {
	let contentsBuffer: Buffer | undefined = encoding === null ? (contents as Buffer) : undefined;
	let contentsHash: string | undefined = undefined;
	let compiledFiles: BuildFile[] = [];
	if (filerDir.buildable && cachedSourceInfo !== undefined) {
		if (encoding === 'utf8') {
			contentsBuffer = Buffer.from(contents);
		} else if (encoding !== null) {
			throw new UnreachableError(encoding);
		}
		contentsHash = toHash(contentsBuffer!);
		if (contentsHash === cachedSourceInfo.contentsHash) {
			compiledFiles = await reconstructBuildFiles(cachedSourceInfo);
		}
	}
	if (filerDir.type === 'externals') {
		if (encoding !== 'utf8') {
			throw Error(`Externals sources must have utf8 encoding, not '${encoding}': ${id}`);
		}
		let filename = basename(id) + (id.endsWith(extension) ? '' : extension);
		const dir = `${filerDir.dir}/${dirname(id)}/`; // TODO the slash is currently needed because paths.sourceId and the rest have a trailing slash, but this may cause other problems
		const dirBasePath = stripStart(dir, filerDir.dir + '/'); // TODO see above comment about `+ '/'`
		return {
			type: 'source',
			sourceType: 'externals',
			buildable: true,
			buildConfigs: [],
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
			compiledFiles,
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
						buildConfigs: [],
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
						compiledFiles,
						stats: undefined,
						mimeType: undefined,
				  }
				: {
						type: 'source',
						sourceType: 'text',
						buildConfigs: null,
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
						compiledFiles: null,
						stats: undefined,
						mimeType: undefined,
				  };
		case null:
			return filerDir.buildable
				? {
						type: 'source',
						sourceType: 'binary',
						buildConfigs: [],
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
						compiledFiles,
						stats: undefined,
						mimeType: undefined,
				  }
				: {
						type: 'source',
						sourceType: 'binary',
						buildConfigs: null,
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
						compiledFiles: null,
						stats: undefined,
						mimeType: undefined,
				  };
		default:
			throw new UnreachableError(encoding);
	}
};
