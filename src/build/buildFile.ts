import {Compilation, CompileOptions, CompileResult} from '../compile/compiler.js';
import {UnreachableError} from '../utils/error.js';
import {BaseFilerFile} from './baseFilerFile.js';
import {CachedSourceInfo} from './Filer.js';
import {SOURCE_MAP_EXTENSION} from '../paths.js';
import {postprocess} from './postprocess.js';
import {basename, dirname, extname} from 'path';
import {loadContents} from './load.js';
import {BuildableSourceFile} from './sourceFile.js';
import {stripEnd} from '../utils/string.js';
import {BuildConfig} from '../config/buildConfig.js';

export type BuildFile = TextBuildFile | BinaryBuildFile;
export interface TextBuildFile extends BaseBuildFile {
	readonly encoding: 'utf8';
	readonly contents: string;
	readonly sourceMapOf: string | null; // TODO maybe prefer a union with an `isSourceMap` boolean flag?
}
export interface BinaryBuildFile extends BaseBuildFile {
	readonly encoding: null;
	readonly contents: Buffer;
	readonly contentsBuffer: Buffer;
}
interface BaseBuildFile extends BaseFilerFile {
	readonly type: 'build';
	readonly sourceFileId: string;
	readonly buildConfig: BuildConfig;
	readonly locals: string[]; // TODO is this right? or maybe a set?
	readonly externals: string[]; // TODO is this right? or maybe a set?
}

export const createBuildFile = (
	compilation: Compilation,
	compileOptions: CompileOptions,
	result: CompileResult<Compilation>,
	sourceFile: BuildableSourceFile,
	buildConfig: BuildConfig,
): BuildFile => {
	const [contents, locals, externals] = postprocess(
		compilation,
		compileOptions,
		result,
		sourceFile,
	);
	switch (compilation.encoding) {
		case 'utf8':
			return {
				type: 'build',
				sourceFileId: sourceFile.id,
				buildConfig,
				locals,
				externals,
				id: compilation.id,
				filename: compilation.filename,
				dir: compilation.dir,
				extension: compilation.extension,
				encoding: compilation.encoding,
				contents: contents as string,
				sourceMapOf: compilation.sourceMapOf,
				contentsBuffer: undefined,
				contentsHash: undefined,
				stats: undefined,
				mimeType: undefined,
			};
		case null:
			return {
				type: 'build',
				sourceFileId: sourceFile.id,
				buildConfig,
				locals,
				externals,
				id: compilation.id,
				filename: compilation.filename,
				dir: compilation.dir,
				extension: compilation.extension,
				encoding: compilation.encoding,
				contents: contents as Buffer,
				contentsBuffer: compilation.contents,
				contentsHash: undefined,
				stats: undefined,
				mimeType: undefined,
			};
		default:
			throw new UnreachableError(compilation);
	}
};

export const reconstructBuildFiles = (
	cachedSourceInfo: CachedSourceInfo,
	buildConfigs: BuildConfig[],
): Promise<BuildFile[]> =>
	Promise.all(
		cachedSourceInfo.compilations.map(
			async (compilation): Promise<BuildFile> => {
				const {id} = compilation;
				const filename = basename(id);
				const dir = dirname(id) + '/'; // TODO the slash is currently needed because paths.sourceId and the rest have a trailing slash, but this may cause other problems
				const extension = extname(id);
				const contents = await loadContents(compilation.encoding, id);
				const buildConfig = buildConfigs.find((b) => b.name === compilation.buildConfigName)!;
				switch (compilation.encoding) {
					case 'utf8':
						return {
							type: 'build',
							sourceFileId: cachedSourceInfo.sourceId,
							buildConfig,
							locals: compilation.locals,
							externals: compilation.externals,
							id,
							filename,
							dir,
							extension,
							encoding: compilation.encoding,
							contents: contents as string,
							sourceMapOf: id.endsWith(SOURCE_MAP_EXTENSION)
								? stripEnd(id, SOURCE_MAP_EXTENSION)
								: null,
							contentsBuffer: undefined,
							contentsHash: undefined,
							stats: undefined,
							mimeType: undefined,
						};
					case null:
						return {
							type: 'build',
							sourceFileId: cachedSourceInfo.sourceId,
							buildConfig,
							locals: compilation.locals,
							externals: compilation.externals,
							id,
							filename,
							dir,
							extension,
							encoding: compilation.encoding,
							contents: contents as Buffer,
							contentsBuffer: contents as Buffer,
							contentsHash: undefined,
							stats: undefined,
							mimeType: undefined,
						};
					default:
						throw new UnreachableError(compilation.encoding);
				}
			},
		),
	);
