import type {Encoding} from '../fs/encoding.js';
import {outputFile, remove} from '../fs/nodeFs.js';
import {JSON_EXTENSION} from '../paths.js';
import {getFileContentsHash} from './baseFilerFile.js';
import type {BuildDependency} from './builder.js';
import type {BuildableSourceFile} from './sourceFile.js';

export interface CachedSourceInfoData {
	readonly sourceId: string;
	readonly contentsHash: string;
	readonly builds: {
		readonly id: string;
		readonly name: string;
		readonly dependencies: BuildDependency[] | null;
		readonly encoding: Encoding;
	}[];
}

export interface CachedSourceInfo {
	readonly cacheId: string; // path to the cached JSON file on disk
	readonly data: CachedSourceInfoData; // the plain JSON written to disk
}

const CACHED_SOURCE_INFO_DIR = 'src'; // so `/.gro/src/` is metadata for `/src`
export const toCachedSourceInfoDir = (buildRootDir: string): string =>
	`${buildRootDir}${CACHED_SOURCE_INFO_DIR}`;

// TODO as an optimization, this should be debounced per file,
// because we're writing per build config.
export const updateCachedSourceInfo = async (
	cachedSourceInfoBySourceId: Map<string, CachedSourceInfo>,
	file: BuildableSourceFile,
	buildRootDir: string,
): Promise<void> => {
	if (file.buildConfigs.size === 0)
		return deleteCachedSourceInfo(cachedSourceInfoBySourceId, file.id);
	const cacheId = toCachedSourceInfoId(file, buildRootDir);
	const data: CachedSourceInfoData = {
		sourceId: file.id,
		contentsHash: getFileContentsHash(file),
		builds: Array.from(file.buildFiles.values()).flatMap((files) =>
			files.map((file) => ({
				id: file.id,
				name: file.buildConfig.name,
				dependencies: file.dependenciesByBuildId && Array.from(file.dependenciesByBuildId.values()),
				encoding: file.encoding,
			})),
		),
	};
	const cachedSourceInfo: CachedSourceInfo = {cacheId, data};
	// This is useful for debugging, but has false positives
	// when source changes but output doesn't, like if comments get elided.
	// if (
	// 	(await pathExists(cacheId)) &&
	// 	deepEqual(await readJson(cacheId), cachedSourceInfo)
	// ) {
	// 	console.log(
	// 		'wasted build detected! unchanged file was built and identical source info written to disk: ' +
	// 			cacheId,
	// 	);

	// }
	cachedSourceInfoBySourceId.set(file.id, cachedSourceInfo);
	// this.log.trace('outputting cached source info', gray(cacheId));
	await outputFile(cacheId, JSON.stringify(data, null, 2));
};

export const deleteCachedSourceInfo = async (
	cachedSourceInfoBySourceId: Map<string, CachedSourceInfo>,
	sourceId: string,
): Promise<void> => {
	const info = cachedSourceInfoBySourceId.get(sourceId);
	if (info === undefined) return; // silently do nothing, which is fine because it's a cache
	cachedSourceInfoBySourceId.delete(sourceId);
	return remove(info.cacheId);
};

const toCachedSourceInfoId = (file: BuildableSourceFile, buildRootDir: string): string =>
	`${buildRootDir}${CACHED_SOURCE_INFO_DIR}/${file.dirBasePath}${file.filename}${JSON_EXTENSION}`;
