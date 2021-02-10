import {Compilation, CompileOptions, CompileResult} from '../compile/compiler.js';
import {UnreachableError} from '../utils/error.js';
import {BaseFilerFile} from './baseFilerFile.js';
import {CachedSourceInfo} from './Filer.js';
import {SOURCEMAP_EXTENSION} from '../paths.js';
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
export interface BaseBuildFile extends BaseFilerFile {
	readonly type: 'build';
	readonly sourceFileId: string;
	readonly buildConfig: BuildConfig;
	readonly localDependencies: Set<string> | null; // TODO is this right? or maybe a set?
	readonly externalDependencies: Set<string> | null; // TODO is this right? or maybe a set?
}

export const createBuildFile = (
	compilation: Compilation,
	compileOptions: CompileOptions,
	result: CompileResult<Compilation>,
	sourceFile: BuildableSourceFile,
	buildConfig: BuildConfig,
): BuildFile => {
	const [contents, localDependencies, externalDependencies] = postprocess(
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
				localDependencies,
				externalDependencies,
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
				localDependencies,
				externalDependencies,
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
				const {
					id,
					buildConfigName,
					externalDependencies,
					localDependencies,
					encoding,
				} = compilation;
				const filename = basename(id);
				const dir = dirname(id) + '/'; // TODO the slash is currently needed because paths.sourceId and the rest have a trailing slash, but this may cause other problems
				const extension = extname(id);
				const contents = await loadContents(encoding, id);
				const buildConfig = buildConfigs.find((b) => b.name === buildConfigName)!;
				switch (encoding) {
					case 'utf8':
						return {
							type: 'build',
							sourceFileId: cachedSourceInfo.sourceId,
							buildConfig,
							localDependencies: localDependencies && new Set(localDependencies),
							externalDependencies: externalDependencies && new Set(externalDependencies),
							id,
							filename,
							dir,
							extension,
							encoding,
							contents: contents as string,
							sourceMapOf: id.endsWith(SOURCEMAP_EXTENSION)
								? stripEnd(id, SOURCEMAP_EXTENSION)
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
							localDependencies: localDependencies && new Set(localDependencies),
							externalDependencies: externalDependencies && new Set(externalDependencies),
							id,
							filename,
							dir,
							extension,
							encoding,
							contents: contents as Buffer,
							contentsBuffer: contents as Buffer,
							contentsHash: undefined,
							stats: undefined,
							mimeType: undefined,
						};
					default:
						throw new UnreachableError(encoding);
				}
			},
		),
	);

// TODO rename? move?
interface DependencyInfo {
	id: string;
	external: boolean;
}

// Returns the dependency changes between two sets of build files.
// Lazily instantiate the collections as an optimization -
// this function is expected to return `null` most of the time.
export const diffDependencies = (
	newFiles: readonly BuildFile[],
	oldFiles: readonly BuildFile[],
):
	| null
	| [addedDependencies: DependencyInfo[] | null, removedDependencies: DependencyInfo[] | null] => {
	let addedDependencies: DependencyInfo[] | null = null;
	let removedDependencies: DependencyInfo[] | null = null;

	// Aggregate all of the dependencies for each source file.
	let newLocalDependencies: Set<string> | null = null;
	let newExternalDependencies: Set<string> | null = null;
	let oldLocalDependencies: Set<string> | null = null;
	let oldExternalDependencies: Set<string> | null = null;
	for (const newFile of newFiles) {
		if (newFile.localDependencies !== null) {
			for (const localDependency of newFile.localDependencies) {
				(newLocalDependencies || (newLocalDependencies = new Set<string>())).add(localDependency);
			}
		}
		if (newFile.externalDependencies !== null) {
			for (const externalDependency of newFile.externalDependencies) {
				(newExternalDependencies || (newExternalDependencies = new Set<string>())).add(
					externalDependency,
				);
			}
		}
	}
	for (const oldFile of oldFiles) {
		if (oldFile.localDependencies !== null) {
			for (const localDependency of oldFile.localDependencies) {
				(oldLocalDependencies || (oldLocalDependencies = new Set<string>())).add(localDependency);
			}
		}
		if (oldFile.externalDependencies !== null) {
			for (const externalDependency of oldFile.externalDependencies) {
				(oldExternalDependencies || (oldExternalDependencies = new Set<string>())).add(
					externalDependency,
				);
			}
		}
	}

	// Figure out which dependencies were added and removed.
	if (newLocalDependencies !== null) {
		for (const newLocalDependency of newLocalDependencies) {
			if (oldLocalDependencies === null || !oldLocalDependencies.has(newLocalDependency)) {
				(addedDependencies || (addedDependencies = [])).push({
					id: newLocalDependency,
					external: false,
				});
			}
		}
	}
	if (newExternalDependencies !== null) {
		for (const newExternalDependency of newExternalDependencies) {
			if (oldExternalDependencies === null || !oldExternalDependencies.has(newExternalDependency)) {
				(addedDependencies || (addedDependencies = [])).push({
					id: newExternalDependency,
					external: true,
				});
			}
		}
	}
	if (oldLocalDependencies !== null) {
		for (const oldLocalDependency of oldLocalDependencies) {
			if (newLocalDependencies === null || !newLocalDependencies.has(oldLocalDependency)) {
				(removedDependencies || (removedDependencies = [])).push({
					id: oldLocalDependency,
					external: false,
				});
			}
		}
	}
	if (oldExternalDependencies !== null) {
		for (const oldExternalDependency of oldExternalDependencies) {
			if (newExternalDependencies === null || !newExternalDependencies.has(oldExternalDependency)) {
				(removedDependencies || (removedDependencies = [])).push({
					id: oldExternalDependency,
					external: true,
				});
			}
		}
	}

	return addedDependencies !== null || removedDependencies !== null
		? [addedDependencies, removedDependencies]
		: null;
};
