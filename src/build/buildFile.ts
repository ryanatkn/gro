import {Build, BuildOptions, BuildResult} from './builder.js';
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
	build: Build,
	buildOptions: BuildOptions,
	result: BuildResult<Build>,
	sourceFile: BuildableSourceFile,
	buildConfig: BuildConfig,
): BuildFile => {
	const [contents, localDependencies, externalDependencies] = postprocess(
		build,
		buildOptions,
		result,
		sourceFile,
	);
	switch (build.encoding) {
		case 'utf8':
			return {
				type: 'build',
				sourceFileId: sourceFile.id,
				buildConfig,
				localDependencies,
				externalDependencies,
				id: build.id,
				filename: build.filename,
				dir: build.dir,
				extension: build.extension,
				encoding: build.encoding,
				contents: contents as string,
				sourceMapOf: build.sourceMapOf,
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
				id: build.id,
				filename: build.filename,
				dir: build.dir,
				extension: build.extension,
				encoding: build.encoding,
				contents: contents as Buffer,
				contentsBuffer: build.contents,
				contentsHash: undefined,
				stats: undefined,
				mimeType: undefined,
			};
		default:
			throw new UnreachableError(build);
	}
};

export const reconstructBuildFiles = async (
	cachedSourceInfo: CachedSourceInfo,
	buildConfigs: BuildConfig[],
): Promise<Map<BuildConfig, BuildFile[]>> => {
	const buildFiles: Map<BuildConfig, BuildFile[]> = new Map();
	await Promise.all(
		cachedSourceInfo.data.builds.map(
			async (build): Promise<void> => {
				const {id, name, externalDependencies, localDependencies, encoding} = build;
				const filename = basename(id);
				const dir = dirname(id) + '/'; // TODO the slash is currently needed because paths.sourceId and the rest have a trailing slash, but this may cause other problems
				const extension = extname(id);
				const contents = await loadContents(encoding, id);
				const buildConfig = buildConfigs.find((b) => b.name === name)!; // is a bit awkward, but probably not inefficient enough to change
				let buildFile: BuildFile;
				switch (encoding) {
					case 'utf8':
						buildFile = {
							type: 'build',
							sourceFileId: cachedSourceInfo.data.sourceId,
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
						break;
					case null:
						buildFile = {
							type: 'build',
							sourceFileId: cachedSourceInfo.data.sourceId,
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
						break;
					default:
						throw new UnreachableError(encoding);
				}
				addBuildFile(buildFile, buildFiles, buildConfig);
			},
		),
	);
	return buildFiles;
};

const addBuildFile = (
	buildFile: BuildFile,
	buildFiles: Map<BuildConfig, BuildFile[]>,
	buildConfig: BuildConfig,
): void => {
	let files = buildFiles.get(buildConfig);
	if (files === undefined) {
		files = [];
		buildFiles.set(buildConfig, files);
	}
	files.push(buildFile);
};

// TODO rename? move?
export interface DependencyInfo {
	id: string;
	external: boolean;
}

// TODO maybe this should take in cached aggregated data from the source file, not `oldBuildFiles`?

// Returns the dependency changes between two sets of build files.
// Lazily instantiate the collections as a small optimization -
// this function is expected to return `null` most of the time.
export const diffDependencies = (
	newFiles: readonly BuildFile[],
	oldFiles: readonly BuildFile[] | null,
): {
	addedDependencies: DependencyInfo[] | null;
	removedDependencies: DependencyInfo[] | null;
} | null => {
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
				(newLocalDependencies || (newLocalDependencies = new Set())).add(localDependency);
			}
		}
		if (newFile.externalDependencies !== null) {
			for (const externalDependency of newFile.externalDependencies) {
				(newExternalDependencies || (newExternalDependencies = new Set())).add(externalDependency);
			}
		}
	}
	if (oldFiles !== null) {
		for (const oldFile of oldFiles) {
			if (oldFile.localDependencies !== null) {
				for (const localDependency of oldFile.localDependencies) {
					(oldLocalDependencies || (oldLocalDependencies = new Set())).add(localDependency);
				}
			}
			if (oldFile.externalDependencies !== null) {
				for (const externalDependency of oldFile.externalDependencies) {
					(oldExternalDependencies || (oldExternalDependencies = new Set())).add(
						externalDependency,
					);
				}
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
		? {addedDependencies, removedDependencies}
		: null;
};
