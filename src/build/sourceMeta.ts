import type {Encoding} from '../fs/encoding.js';
import {JSON_EXTENSION, toBuildOutDirname} from '../paths.js';
import {getFileContentsHash} from './baseFilerFile.js';
import type {BuildDependency, BuildContext} from './builder.js';
import type {BuildableSourceFile} from './sourceFile.js';
import {isExternalBrowserModule} from '../utils/module.js';
import {gray} from '../utils/terminal.js';
import type {BuildName} from '../build/buildConfig.js';

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
	readonly name: BuildName; // TODO doesn't feel right, maybe rename to `buildName`
	readonly dependencies: BuildDependency[] | null;
	readonly encoding: Encoding;
}

const CACHED_SOURCE_INFO_DIR_SUFFIX = '_meta'; // so `/.gro/dev_meta` is metadata for `/.gro/dev`
export const toSourceMetaDir = (buildDir: string, dev: boolean): string =>
	`${buildDir}${toBuildOutDirname(dev)}${CACHED_SOURCE_INFO_DIR_SUFFIX}`;

// TODO as an optimization, this should be debounced per file,
// because we're writing per build config.
export const updateSourceMeta = async (
	ctx: BuildContext,
	file: BuildableSourceFile,
): Promise<void> => {
	const {fs, sourceMetaById, dev, buildDir} = ctx;
	if (file.buildConfigs.size === 0) {
		return deleteSourceMeta(ctx, file.id);
	}

	// create the new meta, not mutating the old
	const cacheId = toSourceMetaId(file, buildDir, dev);
	const data: SourceMetaData = {
		sourceId: file.id,
		contentsHash: getFileContentsHash(file),
		builds: Array.from(file.buildFiles.values()).flatMap((files) =>
			files.map(
				(file): SourceMetaBuild => ({
					id: file.id,
					name: file.buildConfig.name,
					dependencies:
						file.dependenciesByBuildId && Array.from(file.dependenciesByBuildId.values()),
					encoding: file.encoding,
				}),
			),
		),
	};
	const sourceMeta: SourceMeta = {cacheId, data};
	// TODO convert this to a test
	// This is useful for debugging, but has false positives
	// when source changes but output doesn't, like if comments get elided.
	// if (
	// 	(await fs.exists(cacheId)) &&
	// 	deepEqual(JSON.parse(await readFile(cacheId, 'utf8')), sourceMeta)
	// ) {
	// 	console.log(
	// 		'wasted build detected! unchanged file was built and identical source meta written to disk: ' +
	// 			cacheId,
	// 	);
	// }

	sourceMetaById.set(file.id, sourceMeta);
	// this.log.trace('outputting source meta', gray(cacheId));
	await fs.writeFile(cacheId, JSON.stringify(data, null, 2));
};

export const deleteSourceMeta = async (
	{fs, sourceMetaById}: BuildContext,
	sourceId: string,
): Promise<void> => {
	const meta = sourceMetaById.get(sourceId);
	if (meta === undefined) return; // silently do nothing, which is fine because it's a cache
	sourceMetaById.delete(sourceId);
	await fs.remove(meta.cacheId);
};

const toSourceMetaId = (file: BuildableSourceFile, buildDir: string, dev: boolean): string =>
	`${toSourceMetaDir(buildDir, dev)}/${file.dirBasePath}${file.filename}${JSON_EXTENSION}`;

export const initSourceMeta = async ({
	fs,
	sourceMetaById,
	buildDir,
	dev,
}: BuildContext): Promise<void> => {
	const sourceMetaDir = toSourceMetaDir(buildDir, dev);
	if (!(await fs.exists(sourceMetaDir))) return;
	const files = await fs.findFiles(sourceMetaDir, undefined, null);
	await Promise.all(
		Array.from(files.entries()).map(async ([path, stats]) => {
			if (stats.isDirectory()) return;
			const cacheId = `${sourceMetaDir}/${path}`;
			const data: SourceMetaData = JSON.parse(await fs.readFile(cacheId, 'utf8'));
			sourceMetaById.set(data.sourceId, {cacheId, data});
		}),
	);
};

// Cached source meta may be stale if any source files were moved or deleted
// since the last time the Filer ran.
// We can simply delete any cached meta that doesn't map back to a source file.
export const cleanSourceMeta = async (
	ctx: BuildContext,
	fileExists: (id: string) => boolean,
): Promise<void> => {
	const {sourceMetaById, log} = ctx;
	let promises: Promise<void>[] | null = null;
	for (const sourceId of sourceMetaById.keys()) {
		if (!fileExists(sourceId) && !isExternalBrowserModule(sourceId)) {
			log.trace('deleting unknown source meta', gray(sourceId));
			(promises || (promises = [])).push(deleteSourceMeta(ctx, sourceId));
		}
	}
	if (promises !== null) await Promise.all(promises);
};
