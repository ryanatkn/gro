import {gray} from 'kleur/colors';

import type {Encoding} from '../fs/encoding.js';
import {JSON_EXTENSION, to_build_out_dirname, type SourceId} from '../path/paths.js';
import {getFileContentHash} from './filerFile.js';
import type {BuildContext} from './builder.js';
import type {SourceFile} from './sourceFile.js';
import type {BuildName} from './buildConfig.js';
import {
	serialize_build_dependency,
	deserialize_build_dependency,
	type BuildDependency,
	type SerializedBuildDependency,
} from './buildDependency.js';
import type {Filesystem} from '../fs/filesystem.js';
import {throttle} from '../util/throttle.js';

export interface SourceMeta {
	readonly cacheId: string; // path to the cached JSON file on disk
	readonly data: SourceMetaData; // the plain JSON written to disk
}
export interface SourceMetaData {
	readonly source_id: SourceId;
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
	readonly source_id: SourceId;
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
export const toSourceMetaDir = (build_dir: string, dev: boolean): string =>
	`${build_dir}${to_build_out_dirname(dev)}${CACHED_SOURCE_INFO_DIR_SUFFIX}`;

// TODO as an optimization, this should be debounced per file,
// because we're writing per build config.
export const updateSourceMeta = async (ctx: BuildContext, file: SourceFile): Promise<void> => {
	const {fs, sourceMetaById, dev, build_dir, buildNames} = ctx;

	// create the new meta, not mutating the old
	const cacheId = toSourceMetaCacheId(file, build_dir, dev);
	const data: SourceMetaData = {
		source_id: file.id,
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
	// this.log.debug('outputting source meta', gray(cacheId));
	await writeSourceMeta(fs, cacheId, data);
};

const writeSourceMeta = throttle(
	(fs: Filesystem, cacheId: string, data: SourceMetaData): Promise<void> =>
		fs.writeFile(cacheId, JSON.stringify(serializeSourceMeta(data), null, 2)),
	(_, cacheId) => cacheId,
);

export const deleteSourceMeta = async (
	{fs, sourceMetaById}: BuildContext,
	source_id: SourceId,
): Promise<void> => {
	const meta = sourceMetaById.get(source_id);
	if (meta === undefined) return; // silently do nothing, which is fine because it's a cache
	sourceMetaById.delete(source_id);
	await fs.remove(meta.cacheId);
};

const toSourceMetaCacheId = (file: SourceFile, build_dir: string, dev: boolean): string =>
	`${toSourceMetaDir(build_dir, dev)}/${file.dirBasePath}${file.filename}${JSON_EXTENSION}`;

// TODO optimize to load meta only for the build configs
export const initSourceMeta = async ({
	fs,
	sourceMetaById,
	build_dir,
	dev,
}: BuildContext): Promise<void> => {
	const sourceMetaDir = toSourceMetaDir(build_dir, dev);
	if (!(await fs.exists(sourceMetaDir))) return;
	const files = await fs.findFiles(sourceMetaDir, undefined, null);
	await Promise.all(
		Array.from(files.keys()).map(async (path) => {
			const cacheId = `${sourceMetaDir}/${path}`;
			const data = deserializeSourceMeta(JSON.parse(await fs.readFile(cacheId, 'utf8')));
			sourceMetaById.set(data.source_id, {cacheId, data});
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
		Array.from(sourceMetaById.keys()).map(async (source_id) => {
			if (!(await fs.exists(source_id))) {
				log.debug('deleting unknown source meta', gray(source_id));
				await deleteSourceMeta(ctx, source_id);
			}
		}),
	);
};

// these are optimizations to write less data to disk
export const deserializeSourceMeta = ({
	source_id,
	contentHash,
	builds,
}: SerializedSourceMetaData): SourceMetaData => ({
	source_id,
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
	dependencies: dependencies ? dependencies.map((d) => deserialize_build_dependency(d)) : null,
	encoding: encoding !== undefined ? encoding : 'utf8',
});

export const serializeSourceMeta = ({
	source_id,
	contentHash,
	builds,
}: SourceMetaData): SerializedSourceMetaData => ({
	source_id,
	contentHash,
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
		serialized.dependencies = dependencies.map((d) => serialize_build_dependency(d));
	}
	if (encoding !== 'utf8') {
		serialized.encoding = encoding;
	}
	return serialized;
};
