import {findFiles, remove, outputFile, pathExists, readJson} from '../fs/nodeFs.js';
import type {Encoding} from '../fs/encoding.js';
import {JSON_EXTENSION} from '../paths.js';
import {getFileContentsHash} from './baseFilerFile.js';
import type {BuildDependency, BuildContext} from './builder.js';
import type {BuildableSourceFile} from './sourceFile.js';
import {isExternalBrowserModule} from '../utils/module.js';
import {gray} from '../colors/terminal.js';

export interface SourceMeta {
	readonly cacheId: string; // path to the cached JSON file on disk
	readonly data: SourceMetaData; // the plain JSON written to disk
}

export interface SourceMetaData {
	readonly sourceId: string;
	readonly contentsHash: string;
	readonly builds: SourceMetaBuild[];
}

export interface SourceMetaBuild {
	readonly id: string;
	readonly name: string; // TODO doesn't feel right, maybe rename to `buildName`
	readonly dependencies: BuildDependency[] | null;
	readonly encoding: Encoding;
}

const CACHED_SOURCE_INFO_DIR = 'src'; // so `/.gro/src/` is metadata for `/src`
export const toSourceMetaDir = (buildDir: string): string => `${buildDir}${CACHED_SOURCE_INFO_DIR}`;

// TODO as an optimization, this should be debounced per file,
// because we're writing per build config.
export const updateSourceMeta = async (
	sourceMetaBySourceId: Map<string, SourceMeta>,
	file: BuildableSourceFile,
	{buildDir}: BuildContext,
): Promise<void> => {
	if (file.buildConfigs.size === 0) {
		return deleteSourceMeta(sourceMetaBySourceId, file.id);
	}
	const cacheId = toSourceMetaId(file, buildDir);
	const data: SourceMetaData = {
		sourceId: file.id,
		contentsHash: getFileContentsHash(file),
		builds: Array.from(file.buildFiles.values()).flatMap((files) =>
			// TODO better way to get this type safety? rather unordinary!
			// without this annotation, additional unknown props pass through without warning
			files.map((file): SourceMetaData['builds'][0] => ({
				id: file.id,
				name: file.buildConfig.name,
				dependencies: file.dependenciesByBuildId && Array.from(file.dependenciesByBuildId.values()),
				encoding: file.encoding,
			})),
		),
	};
	const sourceMeta: SourceMeta = {cacheId, data};
	// This is useful for debugging, but has false positives
	// when source changes but output doesn't, like if comments get elided.
	// if (
	// 	(await pathExists(cacheId)) &&
	// 	deepEqual(await readJson(cacheId), sourceMeta)
	// ) {
	// 	console.log(
	// 		'wasted build detected! unchanged file was built and identical source meta written to disk: ' +
	// 			cacheId,
	// 	);
	// }

	sourceMetaBySourceId.set(file.id, sourceMeta);
	// this.log.trace('outputting source meta', gray(cacheId));
	await outputFile(cacheId, JSON.stringify(data, null, 2));
};

export const deleteSourceMeta = async (
	sourceMetaBySourceId: Map<string, SourceMeta>,
	sourceId: string,
): Promise<void> => {
	const info = sourceMetaBySourceId.get(sourceId);
	if (info === undefined) return; // silently do nothing, which is fine because it's a cache
	sourceMetaBySourceId.delete(sourceId);
	return remove(info.cacheId);
};

const toSourceMetaId = (file: BuildableSourceFile, buildDir: string): string =>
	`${buildDir}${CACHED_SOURCE_INFO_DIR}/${file.dirBasePath}${file.filename}${JSON_EXTENSION}`;

export const initSourceMeta = async (
	sourceMetaBySourceId: Map<string, SourceMeta>,
	{buildDir}: BuildContext,
): Promise<void> => {
	const sourceMetaDir = toSourceMetaDir(buildDir);
	if (!(await pathExists(sourceMetaDir))) return;
	const files = await findFiles(sourceMetaDir, undefined, null);
	await Promise.all(
		Array.from(files.entries()).map(async ([path, stats]) => {
			if (stats.isDirectory()) return;
			const cacheId = `${sourceMetaDir}/${path}`;
			const data: SourceMetaData = await readJson(cacheId);
			sourceMetaBySourceId.set(data.sourceId, {cacheId, data});
		}),
	);
};

// Cached source meta may be stale if any source files were moved or deleted
// since the last time the Filer ran.
// We can simply delete any cached info that doesn't map back to a source file.
export const cleanSourceMeta = async (
	sourceMetaBySourceId: Map<string, SourceMeta>,
	fileExists: (id: string) => boolean,
	{log}: BuildContext,
): Promise<void> => {
	let promises: Promise<void>[] | null = null;
	for (const sourceId of sourceMetaBySourceId.keys()) {
		if (!fileExists(sourceId) && !isExternalBrowserModule(sourceId)) {
			log.warn('deleting unknown source meta', gray(sourceId));
			(promises || (promises = [])).push(deleteSourceMeta(sourceMetaBySourceId, sourceId));
		}
	}
	if (promises !== null) await Promise.all(promises);
};
