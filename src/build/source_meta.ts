import {gray} from '@feltcoop/felt/util/terminal.js';

import type {Encoding} from '../fs/encoding.js';
import {JSON_EXTENSION, to_build_out_dirname} from '../paths.js';
import {get_file_contents_hash} from './base_filer_file.js';
import type {Build_Dependency, Build_Context} from './builder.js';
import type {Buildable_Source_File} from './source_file.js';
import {is_external_browser_module} from '../utils/module.js';
import type {Build_Name} from '../build/build_config.js';

export interface Source_Meta {
	readonly cache_id: string; // path to the cached JSON file on disk
	readonly data: Source_MetaData; // the plain JSON written to disk
}

export interface Source_MetaData {
	readonly source_id: string;
	readonly contents_hash: string;
	readonly builds: Source_MetaBuild[];
}

export interface Source_MetaBuild {
	readonly id: string;
	readonly name: Build_Name; // TODO doesn't feel right, maybe rename to `build_name`
	readonly dependencies: Build_Dependency[] | null;
	readonly encoding: Encoding;
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
	const {fs, source_meta_by_id, dev, build_dir} = ctx;
	if (file.build_configs.size === 0) {
		return delete_source_meta(ctx, file.id);
	}

	// create the new meta, not mutating the old
	const cache_id = toSource_MetaId(file, build_dir, dev);
	const data: Source_MetaData = {
		source_id: file.id,
		contents_hash: get_file_contents_hash(file),
		builds: Array.from(file.build_files.values()).flatMap((files) =>
			files.map(
				(file): Source_MetaBuild => ({
					id: file.id,
					name: file.build_config.name,
					dependencies:
						file.dependencies_by_build_id && Array.from(file.dependencies_by_build_id.values()),
					encoding: file.encoding,
				}),
			),
		),
	};
	const source_meta: Source_Meta = {cache_id, data};
	// TODO convert this to a test
	// This is useful for debugging, but has false positives
	// when source changes but output doesn't, like if comments get elided.
	// if (
	// 	(await fs.exists(cache_id)) &&
	// 	deepEqual(JSON.parse(await read_file(cache_id, 'utf8')), source_meta)
	// ) {
	// 	console.log(
	// 		'wasted build detected! unchanged file was built and identical source meta written to disk: ' +
	// 			cache_id,
	// 	);
	// }

	source_meta_by_id.set(file.id, source_meta);
	// this.log.trace('outputting source meta', gray(cache_id));
	await fs.write_file(cache_id, JSON.stringify(data, null, 2));
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

const toSource_MetaId = (file: Buildable_Source_File, build_dir: string, dev: boolean): string =>
	`${to_source_meta_dir(build_dir, dev)}/${file.dir_base_path}${file.filename}${JSON_EXTENSION}`;

export const initSource_Meta = async ({
	fs,
	source_meta_by_id,
	build_dir,
	dev,
}: Build_Context): Promise<void> => {
	const source_metaDir = to_source_meta_dir(build_dir, dev);
	if (!(await fs.exists(source_metaDir))) return;
	const files = await fs.find_files(source_metaDir, undefined, null);
	await Promise.all(
		Array.from(files.entries()).map(async ([path, stats]) => {
			if (stats.isDirectory()) return;
			const cache_id = `${source_metaDir}/${path}`;
			const data: Source_MetaData = JSON.parse(await fs.read_file(cache_id, 'utf8'));
			source_meta_by_id.set(data.source_id, {cache_id, data});
		}),
	);
};

// Cached source meta may be stale if any source files were moved or deleted
// since the last time the Filer ran.
// We can simply delete any cached meta that doesn't map back to a source file.
export const clean_source_meta = async (
	ctx: Build_Context,
	file_exists: (id: string) => boolean,
): Promise<void> => {
	const {source_meta_by_id, log} = ctx;
	let promises: Promise<void>[] | null = null;
	for (const source_id of source_meta_by_id.keys()) {
		if (!file_exists(source_id) && !is_external_browser_module(source_id)) {
			log.trace('deleting unknown source meta', gray(source_id));
			(promises || (promises = [])).push(delete_source_meta(ctx, source_id));
		}
	}
	if (promises !== null) await Promise.all(promises);
};
