import fs from 'fs-extra';
import {existsSync, readFileSync, rmSync} from 'node:fs';

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
import {throttle} from '../util/throttle.js';
import {to_hash} from './helpers.js';
import {find_files} from '../fs/find_files.js';

export interface SourceMeta {
	readonly cache_id: string; // path to the cached JSON file on disk
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
export const to_source_meta_dir = (build_dir: string, dev: boolean): string =>
	`${build_dir}${to_build_out_dirname(dev)}${CACHED_SOURCE_INFO_DIR_SUFFIX}`;

// TODO as an optimization, this should be debounced per file,
// because we're writing per build config.
export const update_source_meta = async (ctx: BuildContext, file: SourceFile): Promise<void> => {
	const {source_meta_by_id, dev, build_dir, build_names} = ctx;

	// create the new meta, not mutating the old
	const cache_id = to_source_meta_cache_id(file, build_dir, dev);
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
	const source_meta: SourceMeta = {cache_id, data};

	// preserve the builds that aren't in this build config set
	const existing_source_meta = source_meta_by_id.get(file.id);
	if (existing_source_meta) {
		for (const build of existing_source_meta.data.builds) {
			if (!build_names!.has(build.build_name)) {
				data.builds.push(build);
			}
		}
	}

	if (!data.builds) {
		return delete_source_meta(ctx, file.id);
	}

	source_meta_by_id.set(file.id, source_meta);
	// this.log.debug('outputting source meta', gray(cache_id));
	await write_source_meta(cache_id, data);
};

const write_source_meta = throttle(
	(cache_id: string, data: SourceMetaData): Promise<void> =>
		fs.writeFile(cache_id, JSON.stringify(serialize_source_meta(data), null, 2)),
	(_, cache_id) => cache_id,
);

export const delete_source_meta = async (
	{source_meta_by_id}: BuildContext,
	source_id: SourceId,
): Promise<void> => {
	const meta = source_meta_by_id.get(source_id);
	if (meta === undefined) return; // silently do nothing, which is fine because it's a cache
	source_meta_by_id.delete(source_id);
	await fs.remove(meta.cache_id);
};

const to_source_meta_cache_id = (file: SourceFile, build_dir: string, dev: boolean): string =>
	`${to_source_meta_dir(build_dir, dev)}/${file.dir_base_path}${file.filename}${JSON_EXTENSION}`;

export const init_source_meta = async (ctx: BuildContext): Promise<void> => {
	const {source_meta_by_id, build_dir, dev} = ctx;
	const source_meta_dir = to_source_meta_dir(build_dir, dev);
	if (!existsSync(source_meta_dir)) return;
	const files = await find_files(source_meta_dir, undefined, null, true);
	for (const cache_id of files.keys()) {
		const data = deserialize_source_meta(JSON.parse(readFileSync(cache_id, 'utf8')));
		if (existsSync(data.source_id)) {
			const source_content_hash = to_hash(readFileSync(data.source_id));
			if (data.content_hash === source_content_hash) {
				source_meta_by_id.set(data.source_id, {cache_id, data});
				return;
			}
		}
		// Either the source file no longer exists or its content hash changed.
		rmSync(cache_id);
	}
};

// these are optimizations to write less data to disk
export const deserialize_source_meta = ({
	source_id,
	content_hash,
	builds,
}: SerializedSourceMetaData): SourceMetaData => ({
	source_id,
	content_hash,
	builds: builds.map((b) => deserialize_source_meta_build(b)),
});

const deserialize_source_meta_build = ({
	id,
	build_name,
	dependencies,
}: SerializedSourceMetaBuild): SourceMetaBuild => ({
	id,
	build_name,
	dependencies: dependencies ? dependencies.map((d) => deserialize_build_dependency(d)) : null,
});

export const serialize_source_meta = ({
	source_id,
	content_hash,
	builds,
}: SourceMetaData): SerializedSourceMetaData => ({
	source_id,
	content_hash,
	builds: builds.map((b) => serialize_source_meta_build(b)),
});

const serialize_source_meta_build = ({
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
