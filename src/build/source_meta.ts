import {gray} from '@feltcoop/felt/util/terminal.js';

import type {Encoding} from 'src/fs/encoding.js';
import {JSON_EXTENSION, to_build_out_dirname} from '../paths.js';
import {get_file_content_hash} from './filer_file.js';
import type {Build_Context} from 'src/build/builder.js';
import type {Buildable_Source_File} from 'src/build/source_file.js';
import type {Build_Name} from 'src/build/build_config.js';
import {EXTERNALS_SOURCE_ID} from './gro_builder_externals_utils.js';
import type {Build_Dependency, Serialized_Build_Dependency} from 'src/build/build_dependency.js';
import {serialize_build_dependency, deserialize_build_dependency} from './build_dependency.js';

export interface Source_Meta {
	readonly cache_id: string; // path to the cached JSON file on disk
	readonly data: Source_Meta_Data; // the plain JSON written to disk
}
export interface Source_Meta_Data {
	readonly source_id: string;
	readonly content_hash: string;
	readonly builds: Source_Meta_Build[];
}
export interface Source_Meta_Build {
	readonly id: string;
	readonly build_name: Build_Name;
	readonly dependencies: Build_Dependency[] | null;
	readonly encoding: Encoding;
}

// The optional properties in the following serialized types
// are not `readonly` in order to simplify object creation.
export interface Serialized_Source_Meta_Data {
	readonly source_id: string;
	readonly content_hash: string;
	readonly builds: Serialized_Source_Meta_Build[];
}
export interface Serialized_Source_Meta_Build {
	readonly id: string;
	readonly build_name: Build_Name;
	dependencies?: Serialized_Build_Dependency[] | null; // `undefined` implies `null`
	encoding?: Encoding; // `undefined` implies `'utf8'`
}

const CACHED_SOURCE_INFO_DIR_SUFFIX = '_meta'; // so `/.gro/dev_meta` is metadata for `/.gro/dev`
export const to_source_meta_dir = (build_dir: string, dev: boolean): string =>
	`${build_dir}${to_build_out_dirname(dev)}${CACHED_SOURCE_INFO_DIR_SUFFIX}`;

// TODO as an optimization, this should be debounced per file,
// because we're writing per build config.
export const update_source_meta = async (
	ctx: Build_Context,
	file: Buildable_Source_File,
): Promise<void> => {
	const {fs, source_meta_by_id, dev, build_dir, build_names} = ctx;
	if (file.build_configs.size === 0) {
		return delete_source_meta(ctx, file.id);
	}

	// create the new meta, not mutating the old
	const cache_id = to_source_meta_id(file, build_dir, dev);
	const data: Source_Meta_Data = {
		source_id: file.id,
		content_hash: get_file_content_hash(file),
		builds: Array.from(file.build_files.values()).flatMap((files) =>
			files.map(
				(file): Source_Meta_Build => ({
					id: file.id,
					build_name: file.build_config.name,
					dependencies:
						file.dependencies_by_build_id && Array.from(file.dependencies_by_build_id.values()),
					encoding: file.encoding,
				}),
			),
		),
	};
	const source_meta: Source_Meta = {cache_id, data};

	// preserve the builds that aren't in this build config set
	// TODO maybe just cache these on the source meta in a separate field (not written to disk)
	const existing_source_meta = source_meta_by_id.get(file.id);
	if (existing_source_meta) {
		for (const build of existing_source_meta.data.builds) {
			if (!build_names!.has(build.build_name)) {
				data.builds.push(build);
			}
		}
	}

	source_meta_by_id.set(file.id, source_meta);
	// this.log.trace('outputting source meta', gray(cache_id));
	await fs.write_file(cache_id, JSON.stringify(serialize_source_meta(data), null, 2));
};

export const delete_source_meta = async (
	{fs, source_meta_by_id}: Build_Context,
	source_id: string,
): Promise<void> => {
	const meta = source_meta_by_id.get(source_id);
	if (meta === undefined) return; // silently do nothing, which is fine because it's a cache
	source_meta_by_id.delete(source_id);
	await fs.remove(meta.cache_id);
};

const to_source_meta_id = (file: Buildable_Source_File, build_dir: string, dev: boolean): string =>
	`${to_source_meta_dir(build_dir, dev)}/${file.dir_base_path}${file.filename}${JSON_EXTENSION}`;

// TODO optimize to load meta only for the build configs
export const init_source_meta = async ({
	fs,
	source_meta_by_id,
	build_dir,
	dev,
}: Build_Context): Promise<void> => {
	const source_meta_dir = to_source_meta_dir(build_dir, dev);
	if (!(await fs.exists(source_meta_dir))) return;
	const files = await fs.find_files(source_meta_dir, undefined, null);
	await Promise.all(
		Array.from(files.entries()).map(async ([path, stats]) => {
			if (stats.isDirectory()) return;
			const cache_id = `${source_meta_dir}/${path}`;
			const data = deserialize_source_meta(JSON.parse(await fs.read_file(cache_id, 'utf8')));
			source_meta_by_id.set(data.source_id, {cache_id, data});
		}),
	);
};

// Cached source meta may be stale if any source files were moved or deleted
// since the last time the Filer ran.
// We can simply delete any cached meta that doesn't map back to a source file.
// It might appear that we could use the already-loaded source files to do this check in memory,
// but that doesn't work if the Filer is created with only a subset of the build configs.
export const clean_source_meta = async (ctx: Build_Context): Promise<void> => {
	const {fs, source_meta_by_id, log} = ctx;
	await Promise.all(
		Array.from(source_meta_by_id.keys()).map(async (source_id) => {
			if (source_id !== EXTERNALS_SOURCE_ID && !(await fs.exists(source_id))) {
				log.trace('deleting unknown source meta', gray(source_id));
				await delete_source_meta(ctx, source_id);
			}
		}),
	);
};

// these are optimizations to write less data to disk
export const deserialize_source_meta = ({
	source_id,
	content_hash,
	builds,
}: Serialized_Source_Meta_Data): Source_Meta_Data => ({
	source_id,
	content_hash,
	builds: builds.map((b) => deserialize_source_meta_build(b)),
});
export const deserialize_source_meta_build = ({
	id,
	build_name,
	dependencies,
	encoding,
}: Serialized_Source_Meta_Build): Source_Meta_Build => ({
	id,
	build_name,
	dependencies: dependencies ? dependencies.map((d) => deserialize_build_dependency(d)) : null,
	encoding: encoding !== undefined ? encoding : 'utf8',
});

export const serialize_source_meta = ({
	source_id,
	content_hash,
	builds,
}: Source_Meta_Data): Serialized_Source_Meta_Data => ({
	source_id: source_id,
	content_hash: content_hash,
	builds: builds.map((b) => serialize_source_meta_build(b)),
});
export const serialize_source_meta_build = ({
	id,
	build_name,
	dependencies,
	encoding,
}: Source_Meta_Build): Serialized_Source_Meta_Build => {
	const serialized: Serialized_Source_Meta_Build = {id, build_name};
	if (dependencies) {
		serialized.dependencies = dependencies.map((d) => serialize_build_dependency(d));
	}
	if (encoding !== 'utf8') {
		serialized.encoding = encoding;
	}
	return serialized;
};
