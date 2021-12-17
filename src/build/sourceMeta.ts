import {gray} from '@feltcoop/felt/util/terminal.js';

import type {Encoding} from 'src/fs/encoding.js';
import {JSON_EXTENSION, toBuildOutDirname} from '../paths.js';
import {getFileContentHash} from './filerFile.js';
import type {BuildContext} from 'src/build/builder.js';
import type {BuildableSourceFile} from 'src/build/sourceFile.js';
import type {BuildName} from 'src/build/buildConfig.js';
import type {BuildDependency, SerializedBuildDependency} from 'src/build/buildDependency.js';
import {serializeBuildDependency, deserializeBuildDependency} from './buildDependency.js';
import type {Filesystem} from 'src/fs/filesystem.js';

export interface SourceMeta {
	readonly cacheId: string; // path to the cached JSON file on disk
	readonly data: SourceMetaData; // the plain JSON written to disk
}
export interface SourceMetaData {
	readonly sourceId: string;
	readonly contentHash: string;
	readonly builds: SourceMetaBuild[];
}
export interface SourceMetaBuild {
	readonly id: string;
	readonly buildName: BuildName;
	readonly dependencies: BuildDependency[] | null;
	readonly encoding: Encoding;
}

// The optional properties in the following serialized types
// are not `readonly` in order to simplify object creation.
export interface SerializedSourceMetaData {
	readonly sourceId: string;
	readonly contentHash: string;
	readonly builds: SerializedSourceMetaBuild[];
}
export interface SerializedSourceMetaBuild {
	readonly id: string;
	readonly buildName: BuildName;
	dependencies?: SerializedBuildDependency[] | null; // `undefined` implies `null`
	encoding?: Encoding; // `undefined` implies `'utf8'`
}

const CACHED_SOURCE_INFO_DIR_SUFFIX = '_meta'; // so `/.gro/devMeta` is metadata for `/.gro/dev`
export const toSourceMetaDir = (buildDir: string, dev: boolean): string =>
	`${buildDir}${toBuildOutDirname(dev)}${CACHED_SOURCE_INFO_DIR_SUFFIX}`;

// TODO as an optimization, this should be debounced per file,
// because we're writing per build config.
export const updateSourceMeta = async (
	ctx: BuildContext,
	file: BuildableSourceFile,
): Promise<void> => {
	const {fs, sourceMetaById, dev, buildDir, buildNames} = ctx;

	// create the new meta, not mutating the old
	const cacheId = toSourceMetaCacheId(file, buildDir, dev);
	const data: SourceMetaData = {
		sourceId: file.id,
		contentHash: getFileContentHash(file),
		builds: Array.from(file.buildFiles.values()).flatMap((files) =>
			files.map(
				(file): SourceMetaBuild => ({
					id: file.id,
					buildName: file.buildConfig.name,
					dependencies: file.dependencies && Array.from(file.dependencies.values()),
					encoding: file.encoding,
				}),
			),
		),
	};
	const sourceMeta: SourceMeta = {cacheId, data};

	// preserve the builds that aren't in this build config set
	const existingSourceMeta = sourceMetaById.get(file.id);
	if (existingSourceMeta) {
		for (const build of existingSourceMeta.data.builds) {
			if (!buildNames!.has(build.buildName)) {
				data.builds.push(build);
			}
		}
	}

	if (!data.builds) {
		return deleteSourceMeta(ctx, file.id);
	}

	sourceMetaById.set(file.id, sourceMeta);
	// this.log.trace('outputting source meta', gray(cacheId));
	await writeSourceMeta(fs, cacheId, data);
};

// TODO extract to something like `throttleAsync`
// TODO delay?
// Throttles the call to a promise-returning function.
// If the throttled function is called while the promise is pending,
// it's queued up to run after the promise completes,
// and only the last call is executed;
// calls except the most recent made during the pending promise are discarded.
// This is distinct from a queue where every call to the throttled function eventually runs.
const writingSourceMeta: Map<string, {callId: number; promise: Promise<void>}> = new Map();
let _callId = 0;

const writeSourceMeta = async (
	fs: Filesystem,
	cacheId: string,
	data: SourceMetaData,
): Promise<void> => {
	const callId = _callId++;
	let cached = writingSourceMeta.get(cacheId);
	if (cached) {
		cached.callId = callId;
		await cached.promise;
		if (cached.callId !== callId) return; // a later call supercedes this one
	}
	const promise = fs
		.writeFile(cacheId, JSON.stringify(serializeSourceMeta(data), null, 2))
		.then(() => {
			if (callId === cached!.callId) {
				writingSourceMeta.delete(cacheId);
			}
		});
	if (!cached) {
		cached = {promise, callId};
		writingSourceMeta.set(cacheId, cached);
	}
	await promise;
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

const toSourceMetaCacheId = (file: BuildableSourceFile, buildDir: string, dev: boolean): string =>
	`${toSourceMetaDir(buildDir, dev)}/${file.dirBasePath}${file.filename}${JSON_EXTENSION}`;

// TODO optimize to load meta only for the build configs
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
			const data = deserializeSourceMeta(JSON.parse(await fs.readFile(cacheId, 'utf8')));
			sourceMetaById.set(data.sourceId, {cacheId, data});
		}),
	);
};

// Cached source meta may be stale if any source files were moved or deleted
// since the last time the Filer ran.
// We can simply delete any cached meta that doesn't map back to a source file.
// It might appear that we could use the already-loaded source files to do this check in memory,
// but that doesn't work if the Filer is created with only a subset of the build configs.
export const cleanSourceMeta = async (ctx: BuildContext): Promise<void> => {
	const {fs, sourceMetaById, log} = ctx;
	await Promise.all(
		Array.from(sourceMetaById.keys()).map(async (sourceId) => {
			if (!(await fs.exists(sourceId))) {
				log.trace('deleting unknown source meta', gray(sourceId));
				await deleteSourceMeta(ctx, sourceId);
			}
		}),
	);
};

// these are optimizations to write less data to disk
export const deserializeSourceMeta = ({
	sourceId,
	contentHash,
	builds,
}: SerializedSourceMetaData): SourceMetaData => ({
	sourceId,
	contentHash,
	builds: builds.map((b) => deserializeSourceMetaBuild(b)),
});
export const deserializeSourceMetaBuild = ({
	id,
	buildName,
	dependencies,
	encoding,
}: SerializedSourceMetaBuild): SourceMetaBuild => ({
	id,
	buildName,
	dependencies: dependencies ? dependencies.map((d) => deserializeBuildDependency(d)) : null,
	encoding: encoding !== undefined ? encoding : 'utf8',
});

export const serializeSourceMeta = ({
	sourceId,
	contentHash,
	builds,
}: SourceMetaData): SerializedSourceMetaData => ({
	sourceId: sourceId,
	contentHash: contentHash,
	builds: builds.map((b) => serializeSourceMetaBuild(b)),
});
export const serializeSourceMetaBuild = ({
	id,
	buildName,
	dependencies,
	encoding,
}: SourceMetaBuild): SerializedSourceMetaBuild => {
	const serialized: SerializedSourceMetaBuild = {id, buildName};
	if (dependencies) {
		serialized.dependencies = dependencies.map((d) => serializeBuildDependency(d));
	}
	if (encoding !== 'utf8') {
		serialized.encoding = encoding;
	}
	return serialized;
};
