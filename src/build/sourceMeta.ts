import type {Encoding} from '../fs/encoding.js';
import {JSON_EXTENSION, toBuildOutDirname} from '../paths.js';
import type {BuildOutDirname} from '../paths.js';
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
	readonly builds: Partial<Record<BuildOutDirname, SourceMetaBuild[]>>;
}

export interface SourceMetaBuild {
	readonly id: string;
	readonly name: BuildName; // TODO doesn't feel right, maybe rename to `buildName`
	readonly dependencies: BuildDependency[] | null;
	readonly encoding: Encoding;
}

const CACHED_SOURCE_INFO_DIR = 'src'; // so `/.gro/src/` is metadata for `/src`
export const toSourceMetaDir = (buildDir: string, dev: boolean): string =>
	`${buildDir}${CACHED_SOURCE_INFO_DIR}`;

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

	const outDirname = toBuildOutDirname(dev);
	const otherOutDirname = toBuildOutDirname(!dev);

	// keep any existing builds of the other mode
	const otherBuilds = sourceMetaById.get(file.id)?.data.builds[otherOutDirname];

	// create the new meta, not mutating the old
	const cacheId = toSourceMetaId(file, buildDir);
	const data: SourceMetaData = {
		sourceId: file.id,
		contentsHash: getFileContentsHash(file),
		builds: {
			[outDirname]: Array.from(file.buildFiles.values()).flatMap((files) =>
				// TODO better way to get this type safety? rather unordinary!
				// without this annotation, additional unknown props pass through without warning
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
			[otherOutDirname]: otherBuilds,
		},
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
	{fs, sourceMetaById, dev}: BuildContext,
	sourceId: string,
): Promise<void> => {
	const meta = sourceMetaById.get(sourceId);
	if (meta === undefined) return; // silently do nothing, which is fine because it's a cache
	sourceMetaById.delete(sourceId);
	// delete the source meta on disk, but only if it has no builds for the other dev/prod mode
	const otherBuilds = meta.data.builds[toBuildOutDirname(!dev)];
	if (!otherBuilds) {
		await fs.remove(meta.cacheId);
	}
};

const toSourceMetaId = (file: BuildableSourceFile, buildDir: string): string =>
	`${buildDir}${CACHED_SOURCE_INFO_DIR}/${file.dirBasePath}${file.filename}${JSON_EXTENSION}`;

export const initSourceMeta = async ({
	fs,
	sourceMetaById,
	buildDir,
}: BuildContext): Promise<void> => {
	const sourceMetaDir = toSourceMetaDir(buildDir);
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
