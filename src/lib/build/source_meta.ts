import {gray} from 'kleur/colors';

import {JSON_EXTENSION, to_build_out_dirname, type SourceId} from '../path/paths.js';
import {get_file_content_hash} from './filer_file.js';
import type {BuildContext} from './builder.js';
import type {SourceFile} from './source_file.js';
import type {BuildName} from './build_config.js';
import {
	serialize_build_dependency,
	deserialize_build_dependency,
	type BuildDependency,
	type SerializedBuildDependency,
} from './build_dependency.js';
import type {Filesystem} from '../fs/filesystem.js';
import {throttle} from '../util/throttle.js';

export interface SourceMeta {
	readonly cacheId: string; // path to the cached JSON file on disk
	readonly data: SourceMetaData; // the plain JSON written to disk
}
export interface SourceMetaData {
	readonly source_id: SourceId;
	readonly content_hash: string;
	readonly builds: SourceMetaBuild[];
}
export interface SourceMetaBuild {
	readonly id: string;
	readonly build_name: BuildName;
	readonly dependencies: BuildDependency[] | null;
}

// The optional properties in the following serialized types
// are not `readonly` in order to simplify object creation.
export interface SerializedSourceMetaData {
	readonly source_id: SourceId;
	readonly content_hash: string;
	readonly builds: SerializedSourceMetaBuild[];
}
export interface SerializedSourceMetaBuild {
	readonly id: string;
	readonly build_name: BuildName;
	dependencies?: SerializedBuildDependency[] | null; // `undefined` implies `null`
}

const CACHED_SOURCE_INFO_DIR_SUFFIX = '_meta'; // so `/.gro/devMeta` is metadata for `/.gro/dev`
export const toSourceMetaDir = (build_dir: string, dev: boolean): string =>
	`${build_dir}${to_build_out_dirname(dev)}${CACHED_SOURCE_INFO_DIR_SUFFIX}`;

// TODO as an optimization, this should be debounced per file,
// because we're writing per build config.
export const update_source_meta = async (ctx: BuildContext, file: SourceFile): Promise<void> => {
	const {fs, source_meta_by_id, dev, build_dir, build_names} = ctx;

	// create the new meta, not mutating the old
	const cacheId = toSourceMetaCacheId(file, build_dir, dev);
	const data: SourceMetaData = {
		source_id: file.id,
		content_hash: get_file_content_hash(file),
		builds: Array.from(file.build_files.values()).flatMap((files) =>
			files.map(
				(file): SourceMetaBuild => ({
					id: file.id,
					build_name: file.build_config.name,
					dependencies: file.dependencies && Array.from(file.dependencies.values()),
				}),
			),
		),
	};
	const source_meta: SourceMeta = {cacheId, data};

	// preserve the builds that aren't in this build config set
	const existingSourceMeta = source_meta_by_id.get(file.id);
	if (existingSourceMeta) {
		for (const build of existingSourceMeta.data.builds) {
			if (!build_names!.has(build.build_name)) {
				data.builds.push(build);
			}
		}
	}

	if (!data.builds) {
		return delete_source_meta(ctx, file.id);
	}

	source_meta_by_id.set(file.id, source_meta);
	// this.log.debug('outputting source meta', gray(cacheId));
	await writeSourceMeta(fs, cacheId, data);
};

const writeSourceMeta = throttle(
	(fs: Filesystem, cacheId: string, data: SourceMetaData): Promise<void> =>
		fs.writeFile(cacheId, JSON.stringify(serializeSourceMeta(data), null, 2)),
	(_, cacheId) => cacheId,
);

export const delete_source_meta = async (
	{fs, source_meta_by_id}: BuildContext,
	source_id: SourceId,
): Promise<void> => {
	const meta = source_meta_by_id.get(source_id);
	if (meta === undefined) return; // silently do nothing, which is fine because it's a cache
	source_meta_by_id.delete(source_id);
	await fs.remove(meta.cacheId);
};

const toSourceMetaCacheId = (file: SourceFile, build_dir: string, dev: boolean): string =>
	`${toSourceMetaDir(build_dir, dev)}/${file.dir_base_path}${file.filename}${JSON_EXTENSION}`;

// TODO optimize to load meta only for the build configs
export const initSourceMeta = async ({
	fs,
	source_meta_by_id,
	build_dir,
	dev,
}: BuildContext): Promise<void> => {
	const source_metaDir = toSourceMetaDir(build_dir, dev);
	if (!(await fs.exists(source_metaDir))) return;
	const files = await fs.findFiles(source_metaDir, undefined, null);
	await Promise.all(
		Array.from(files.keys()).map(async (path) => {
			const cacheId = `${source_metaDir}/${path}`;
			const data = deserializeSourceMeta(JSON.parse(await fs.readFile(cacheId, 'utf8')));
			source_meta_by_id.set(data.source_id, {cacheId, data});
		}),
	);
};

// Cached source meta may be stale if any source files were moved or deleted
// since the last time the Filer ran.
// We can simply delete any cached meta that doesn't map back to a source file.
// It might appear that we could use the already-loaded source files to do this check in memory,
// but that doesn't work if the Filer is created with only a subset of the build configs.
export const cleanSourceMeta = async (ctx: BuildContext): Promise<void> => {
	const {fs, source_meta_by_id, log} = ctx;
	await Promise.all(
		Array.from(source_meta_by_id.keys()).map(async (source_id) => {
			if (!(await fs.exists(source_id))) {
				log.debug('deleting unknown source meta', gray(source_id));
				await delete_source_meta(ctx, source_id);
			}
		}),
	);
};

// these are optimizations to write less data to disk
export const deserializeSourceMeta = ({
	source_id,
	content_hash,
	builds,
}: SerializedSourceMetaData): SourceMetaData => ({
	source_id,
	content_hash,
	builds: builds.map((b) => deserializeSourceMetaBuild(b)),
});
export const deserializeSourceMetaBuild = ({
	id,
	build_name,
	dependencies,
}: SerializedSourceMetaBuild): SourceMetaBuild => ({
	id,
	build_name,
	dependencies: dependencies ? dependencies.map((d) => deserialize_build_dependency(d)) : null,
});

export const serializeSourceMeta = ({
	source_id,
	content_hash,
	builds,
}: SourceMetaData): SerializedSourceMetaData => ({
	source_id,
	content_hash,
	builds: builds.map((b) => serializeSourceMetaBuild(b)),
});
export const serializeSourceMetaBuild = ({
	id,
	build_name,
	dependencies,
}: SourceMetaBuild): SerializedSourceMetaBuild => {
	const serialized: SerializedSourceMetaBuild = {id, build_name};
	if (dependencies) {
		serialized.dependencies = dependencies.map((d) => serialize_build_dependency(d));
	}
	return serialized;
};
