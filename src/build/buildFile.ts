import type {Build, BuildContext, BuildResult} from './builder.js';
import {UnreachableError} from '../utils/error.js';
import {BaseFilerFile} from './baseFilerFile.js';
import type {CachedSourceInfo} from './Filer.js';
import {SOURCEMAP_EXTENSION} from '../paths.js';
import {postprocess} from './postprocess.js';
import {basename, dirname, extname} from 'path';
import {loadContents} from './load.js';
import {BuildableSourceFile} from './sourceFile.js';
import {stripEnd} from '../utils/string.js';
import {BuildConfig} from '../config/buildConfig.js';
import {isExternalBuildId} from './externalsBuildHelpers.js';

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
	readonly sourceId: string;
	readonly external: boolean;
	readonly buildConfig: BuildConfig;
	readonly dependencies: Set<string> | null;
}

export const COMMON_SOURCE_ID = 'common'; // TODO revisit this along with `build.common`

export const createBuildFile = (
	build: Build,
	ctx: BuildContext,
	result: BuildResult<Build>,
	sourceFile: BuildableSourceFile,
	buildConfig: BuildConfig,
): BuildFile => {
	const {contents, dependencies} = postprocess(build, ctx, result, sourceFile);
	switch (build.encoding) {
		case 'utf8':
			return {
				type: 'build',
				// TODO this is a hack, not sure about it -
				// currently used to prevent common externals from being deleted
				sourceId: build.common ? COMMON_SOURCE_ID : sourceFile.id,
				external: sourceFile.external,
				buildConfig,
				dependencies, // TODO should these dependencies be updated for ALL build files in externals as appropriate? are they?
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
				// TODO this is a hack, not sure about it -
				// currently used to prevent common externals from being deleted
				sourceId: build.common ? COMMON_SOURCE_ID : sourceFile.id,
				external: sourceFile.external,
				buildConfig,
				dependencies,
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
	buildConfigs: readonly BuildConfig[],
): Promise<Map<BuildConfig, BuildFile[]>> => {
	const buildFiles: Map<BuildConfig, BuildFile[]> = new Map();
	await Promise.all(
		cachedSourceInfo.data.builds.map(
			async (build): Promise<void> => {
				const {id, name, dependencies, encoding} = build;
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
							sourceId: cachedSourceInfo.data.sourceId,
							external: cachedSourceInfo.data.external,
							buildConfig,
							dependencies: dependencies && new Set(dependencies),
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
							sourceId: cachedSourceInfo.data.sourceId,
							external: cachedSourceInfo.data.external,
							buildConfig,
							dependencies: dependencies && new Set(dependencies),
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
	buildConfig: BuildConfig,
	ctx: BuildContext,
): {
	addedDependencies: DependencyInfo[] | null;
	removedDependencies: DependencyInfo[] | null;
} | null => {
	if (newFiles === oldFiles) return null;
	let addedDependencies: DependencyInfo[] | null = null;
	let removedDependencies: DependencyInfo[] | null = null;

	// Aggregate all of the dependencies for each source file.
	let newDependencies: Set<string> | null = null;
	let oldDependencies: Set<string> | null = null;
	for (const newFile of newFiles) {
		if (newFile.dependencies !== null) {
			for (const dependency of newFile.dependencies) {
				(newDependencies || (newDependencies = new Set())).add(dependency);
			}
		}
	}
	if (oldFiles !== null) {
		for (const oldFile of oldFiles) {
			if (oldFile.dependencies !== null) {
				for (const dependency of oldFile.dependencies) {
					(oldDependencies || (oldDependencies = new Set())).add(dependency);
				}
			}
		}
	}

	// Figure out which dependencies were added and removed.
	if (newDependencies !== null) {
		for (const newDependency of newDependencies) {
			if (oldDependencies === null || !oldDependencies.has(newDependency)) {
				(addedDependencies || (addedDependencies = [])).push({
					id: newDependency,
					external: isExternalBuildId(newDependency, buildConfig, ctx),
				});
			}
		}
	}
	if (oldDependencies !== null) {
		for (const oldDependency of oldDependencies) {
			if (newDependencies === null || !newDependencies.has(oldDependency)) {
				(removedDependencies || (removedDependencies = [])).push({
					id: oldDependency,
					external: isExternalBuildId(oldDependency, buildConfig, ctx),
				});
			}
		}
	}

	return addedDependencies !== null || removedDependencies !== null
		? {addedDependencies, removedDependencies}
		: null;
};
