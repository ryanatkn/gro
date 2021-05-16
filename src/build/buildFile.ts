import type {Build, BuildContext, BuildDependency, BuildResult} from './builder.js';
import {UnreachableError} from '../utils/error.js';
import type {BaseFilerFile} from './baseFilerFile.js';
import type {SourceMeta} from './sourceMeta.js';
import {postprocess} from './postprocess.js';
import {basename, dirname, extname} from 'path';
import {loadContents} from './load.js';
import type {BuildableSourceFile} from './sourceFile.js';
import type {BuildConfig} from '../build/buildConfig.js';
import {toBuildOutDirname} from '../paths.js';
import type {Filesystem} from '../fs/filesystem.js';

export type BuildFile = TextBuildFile | BinaryBuildFile;
export interface TextBuildFile extends BaseBuildFile {
	readonly encoding: 'utf8';
	readonly contents: string;
}
export interface BinaryBuildFile extends BaseBuildFile {
	readonly encoding: null;
	readonly contents: Buffer;
	readonly contentsBuffer: Buffer;
}
export interface BaseBuildFile extends BaseFilerFile {
	readonly type: 'build';
	readonly sourceId: string;
	readonly buildConfig: BuildConfig;
	// This data structure de-dupes by build id, because we can throw away
	// the information of duplicate imports to the same dependency within each build file.
	// We may want to store more granular dependency info, including imported identifiers,
	// in the future.
	readonly dependenciesByBuildId: Map<string, BuildDependency> | null;
}

export const createBuildFile = (
	build: Build,
	ctx: BuildContext,
	result: BuildResult<Build>,
	sourceFile: BuildableSourceFile,
	buildConfig: BuildConfig,
): BuildFile => {
	const {contents, dependenciesByBuildId} = postprocess(build, ctx, result, sourceFile);
	switch (build.encoding) {
		case 'utf8':
			return {
				type: 'build',
				sourceId: sourceFile.id,
				buildConfig,
				dependenciesByBuildId,
				id: build.id,
				filename: build.filename,
				dir: build.dir,
				extension: build.extension,
				encoding: build.encoding,
				contents: contents as string,
				contentsBuffer: undefined,
				contentsHash: undefined,
				stats: undefined,
				mimeType: undefined,
			};
		case null:
			return {
				type: 'build',
				sourceId: sourceFile.id,
				buildConfig,
				dependenciesByBuildId,
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
	fs: Filesystem,
	sourceMeta: SourceMeta,
	buildConfigs: readonly BuildConfig[],
	dev: boolean,
): Promise<Map<BuildConfig, BuildFile[]>> => {
	const buildFiles: Map<BuildConfig, BuildFile[]> = new Map();
	const builds = sourceMeta.data.builds[toBuildOutDirname(dev)];
	if (!builds) return buildFiles;
	await Promise.all(
		builds.map(
			async (build): Promise<void> => {
				const {id, name, dependencies, encoding} = build;
				const filename = basename(id);
				const dir = dirname(id) + '/'; // TODO the slash is currently needed because paths.sourceId and the rest have a trailing slash, but this may cause other problems
				const extension = extname(id);
				const contents = await loadContents(fs, encoding, id);
				const buildConfig = buildConfigs.find((b) => b.name === name)!; // is a bit awkward, but probably not inefficient enough to change
				let buildFile: BuildFile;
				switch (encoding) {
					case 'utf8':
						buildFile = {
							type: 'build',
							sourceId: sourceMeta.data.sourceId,
							buildConfig,
							dependenciesByBuildId:
								dependencies && new Map(dependencies.map((d) => [d.buildId, d])),
							id,
							filename,
							dir,
							extension,
							encoding,
							contents: contents as string,
							contentsBuffer: undefined,
							contentsHash: undefined,
							stats: undefined,
							mimeType: undefined,
						};
						break;
					case null:
						buildFile = {
							type: 'build',
							sourceId: sourceMeta.data.sourceId,
							buildConfig,
							dependenciesByBuildId:
								dependencies && new Map(dependencies.map((d) => [d.buildId, d])),
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

// TODO maybe this should take in cached aggregated data from the source file, not `oldBuildFiles`?

// Returns the dependency changes between two sets of build files.
// Lazily instantiate the collections as a small optimization -
// this function is expected to return `null` most of the time.
export const diffDependencies = (
	newFiles: readonly BuildFile[],
	oldFiles: readonly BuildFile[] | null,
): {
	addedDependencies: BuildDependency[] | null;
	removedDependencies: BuildDependency[] | null;
} | null => {
	if (newFiles === oldFiles) return null;
	let addedDependencies: BuildDependency[] | null = null;
	let removedDependencies: BuildDependency[] | null = null;

	// Aggregate all of the dependencies for each source file. The map de-dupes by build id.
	let newDependencies: Map<string, BuildDependency> | null = null;
	let oldDependencies: Map<string, BuildDependency> | null = null;
	for (const newFile of newFiles) {
		if (newFile.dependenciesByBuildId !== null) {
			for (const dependency of newFile.dependenciesByBuildId.values()) {
				if (newDependencies === null) newDependencies = new Map();
				if (!newDependencies.has(dependency.buildId)) {
					newDependencies.set(dependency.buildId, dependency);
				}
			}
		}
	}
	if (oldFiles !== null) {
		for (const oldFile of oldFiles) {
			if (oldFile.dependenciesByBuildId !== null) {
				for (const dependency of oldFile.dependenciesByBuildId.values()) {
					if (oldDependencies === null) oldDependencies = new Map();
					if (!oldDependencies.has(dependency.buildId)) {
						oldDependencies.set(dependency.buildId, dependency);
					}
				}
			}
		}
	}

	// Figure out which dependencies were added and removed.
	if (newDependencies !== null) {
		for (const newDependency of newDependencies.values()) {
			if (oldDependencies === null || !oldDependencies.has(newDependency.buildId)) {
				if (addedDependencies === null) addedDependencies = [];
				addedDependencies.push(newDependency);
			}
		}
	}
	if (oldDependencies !== null) {
		for (const oldDependency of oldDependencies.values()) {
			if (newDependencies === null || !newDependencies.has(oldDependency.buildId)) {
				if (removedDependencies === null) removedDependencies = [];
				removedDependencies.push(oldDependency);
			}
		}
	}

	return addedDependencies !== null || removedDependencies !== null
		? {addedDependencies, removedDependencies}
		: null;
};
