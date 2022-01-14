import {UnreachableError} from '@feltcoop/felt/util/error.js';

import {type BaseFilerFile} from './filerFile.js';
import {type SourceMeta} from './sourceMeta.js';
import {type BuildDependency} from './buildDependency.js';
import {basename, dirname, extname} from 'path';
import {loadContent} from './load.js';
import {type BuildConfig} from './buildConfig.js';
import {type Filesystem} from '../fs/filesystem.js';

export type BuildFile = TextBuildFile | BinaryBuildFile;
export interface TextBuildFile extends BaseBuildFile {
	readonly encoding: 'utf8';
	readonly content: string;
}
export interface BinaryBuildFile extends BaseBuildFile {
	readonly encoding: null;
	readonly content: Buffer;
	readonly contentBuffer: Buffer;
}
export interface BaseBuildFile extends BaseFilerFile {
	readonly type: 'build';
	readonly sourceId: string;
	readonly buildConfig: BuildConfig;
	// This data structure de-dupes by build id, because we can throw away
	// the information of duplicate imports to the same dependency within each build file.
	// We may want to store more granular dependency info, including imported identifiers,
	// in the future.
	readonly dependencies: Map<string, BuildDependency> | null;
}

export const reconstructBuildFiles = async (
	fs: Filesystem,
	sourceMeta: SourceMeta,
	buildConfigs: readonly BuildConfig[],
): Promise<Map<BuildConfig, BuildFile[]>> => {
	const buildFiles: Map<BuildConfig, BuildFile[]> = new Map();
	await Promise.all(
		sourceMeta.data.builds.map(async (build): Promise<void> => {
			const {id, buildName, dependencies, encoding} = build;
			const filename = basename(id);
			const dir = dirname(id) + '/'; // TODO the slash is currently needed because paths.sourceId and the rest have a trailing slash, but this may cause other problems
			const extension = extname(id);
			const content = await loadContent(fs, encoding, id);
			const buildConfig = buildConfigs.find((b) => b.name === buildName)!; // is a bit awkward, but probably not inefficient enough to change
			if (!buildConfig) {
				// TODO wait no this build needs to be preserved somehow,
				// otherwise running the filer with different build configs fails to preserve

				// If the build config is not found, just ignore the cached data --
				// if it's stale it won't hurt anything, and will disappear the next `gro clean`,
				// and if the Filer ever runs with that config again, it'll read from the cache.
				// We rely on this behavior to have the separate bootstrap config.
				return;
			}
			let buildFile: BuildFile;
			switch (encoding) {
				case 'utf8':
					buildFile = {
						type: 'build',
						sourceId: sourceMeta.data.sourceId,
						buildConfig,
						dependencies: dependencies && new Map(dependencies.map((d) => [d.buildId, d])),
						id,
						filename,
						dir,
						extension,
						encoding,
						content: content as string,
						contentBuffer: undefined,
						contentHash: undefined,
						stats: undefined,
						mimeType: undefined,
					};
					break;
				case null:
					buildFile = {
						type: 'build',
						sourceId: sourceMeta.data.sourceId,
						buildConfig,
						dependencies: dependencies && new Map(dependencies.map((d) => [d.buildId, d])),
						id,
						filename,
						dir,
						extension,
						encoding,
						content: content as Buffer,
						contentBuffer: content as Buffer,
						contentHash: undefined,
						stats: undefined,
						mimeType: undefined,
					};
					break;
				default:
					throw new UnreachableError(encoding);
			}
			addBuildFile(buildFile, buildFiles, buildConfig);
		}),
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
		if (newFile.dependencies !== null) {
			for (const dependency of newFile.dependencies.values()) {
				if (newDependencies === null) newDependencies = new Map();
				if (!newDependencies.has(dependency.buildId)) {
					newDependencies.set(dependency.buildId, dependency);
				}
			}
		}
	}
	if (oldFiles !== null) {
		for (const oldFile of oldFiles) {
			if (oldFile.dependencies !== null) {
				for (const dependency of oldFile.dependencies.values()) {
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
