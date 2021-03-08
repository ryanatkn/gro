import {findFiles, remove, outputFile, pathExists, readJson} from '../fs/nodeFs.js';
import type {Encoding} from '../fs/encoding.js';
import {JSON_EXTENSION} from '../paths.js';
import {getFileContentsHash} from './baseFilerFile.js';
import type {BuildDependency, BuildContext} from './builder.js';
import type {BuildableSourceFile} from './sourceFile.js';
import {isExternalBrowserModule} from '../utils/module.js';
import {gray} from '../colors/terminal.js';

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
	{buildRootDir}: BuildContext,
): Promise<void> => {
	if (file.buildConfigs.size === 0) {
		return deleteCachedSourceInfo(cachedSourceInfoBySourceId, file.id);
	}
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

export const initCachedSourceInfo = async (
	cachedSourceInfoBySourceId: Map<string, CachedSourceInfo>,
	{buildRootDir}: BuildContext,
): Promise<void> => {
	const cachedSourceInfoDir = toCachedSourceInfoDir(buildRootDir);
	if (!(await pathExists(cachedSourceInfoDir))) return;
	const files = await findFiles(cachedSourceInfoDir, undefined, null);
	await Promise.all(
		Array.from(files.entries()).map(async ([path, stats]) => {
			if (stats.isDirectory()) return;
			const cacheId = `${cachedSourceInfoDir}/${path}`;
			const data: CachedSourceInfoData = await readJson(cacheId);
			cachedSourceInfoBySourceId.set(data.sourceId, {cacheId, data});
		}),
	);
};

// Cached source info may be stale if any source files were moved or deleted
// since the last time the Filer ran.
// We can simply delete any cached info that doesn't map back to a source file.
export const cleanCachedSourceInfo = async (
	cachedSourceInfoBySourceId: Map<string, CachedSourceInfo>,
	fileExists: (id: string) => boolean,
	{log}: BuildContext,
): Promise<void> => {
	let promises: Promise<void>[] | null = null;
	for (const sourceId of cachedSourceInfoBySourceId.keys()) {
		if (!fileExists(sourceId) && !isExternalBrowserModule(sourceId)) {
			log.warn('deleting unknown cached source info', gray(sourceId));
			(promises || (promises = [])).push(
				deleteCachedSourceInfo(cachedSourceInfoBySourceId, sourceId),
			);
		}
	}
	if (promises !== null) await Promise.all(promises);
};
