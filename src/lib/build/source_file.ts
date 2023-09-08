import {basename, dirname} from 'node:path';
import {stripStart} from '@feltjs/util/string.js';

import type {FilerDir} from './filer_dir.js';
import {reconstruct_build_files, type BuildFile} from './build_file.js';
import type {BaseFilerFile} from './filer_file.js';
import {to_hash} from './helpers.js';
import type {BuildConfig} from './build_config.js';
import type {SourceMeta} from './source_meta.js';
import type {BuildDependency} from './build_dependency.js';
import type {BuildContext} from './builder.js';
import type {IdFilter} from '../fs/filter.js';
import type {BuildId, SourceId} from '../path/paths.js';

export interface SourceFile extends BaseFilerFile {
	readonly id: SourceId;
	readonly type: 'source';
	readonly dir_base_path: string; // TODO is this the best design? if so should it also go on the `BaseFilerFile`? what about `base_path` too?
	readonly filer_dir: FilerDir;
	readonly build_files: Map<BuildConfig, readonly BuildFile[]>;
	readonly build_configs: Set<BuildConfig>;
	readonly is_input_to_build_configs: null | Set<BuildConfig>;
	readonly dependencies: Map<BuildConfig, Map<SourceId, Map<BuildId, BuildDependency>>>; // `dependencies` are sets of build ids by source file ids, that this one imports or otherwise depends on (they may point to nonexistent files!)
	readonly dependents: Map<BuildConfig, Map<SourceId, Map<BuildId, BuildDependency>>>; // `dependents` are sets of build ids by buildable source file ids, that import or otherwise depend on this one
	readonly virtual: boolean;
	dirty: boolean; // will be `true` for source files with hydrated files that need to rebuild (like detected changes since the filer last ran)
}

export const create_source_file = async (
	id: string,
	extension: string,
	content: string,
	filer_dir: FilerDir,
	source_meta: SourceMeta | undefined,
	virtual: boolean,
	{fs, build_configs}: BuildContext,
): Promise<SourceFile> => {
	let content_buffer: Buffer | undefined;
	let content_hash: string | undefined;
	let reconstructed_build_files: Map<BuildConfig, BuildFile[]> | null = null;
	let dirty = false;
	if (source_meta !== undefined) {
		content_buffer = Buffer.from(content);
		content_hash = to_hash(content_buffer);

		// TODO not sure if `dirty` flag is the best solution here,
		// or if it should be more widely used?
		dirty = content_hash !== source_meta.data.content_hash;
		reconstructed_build_files = await reconstruct_build_files(fs, source_meta, build_configs!);
	}
	const filename = basename(id);
	const dir = dirname(id) + '/'; // TODO the slash is currently needed because paths.source_id and the rest have a trailing slash, but this may cause other problems
	const dir_base_path = stripStart(dir, filer_dir.dir + '/'); // TODO see above comment about `+ '/'`

	return {
		type: 'source',
		build_configs: new Set(),
		is_input_to_build_configs: null,
		dependencies: new Map(),
		dependents: new Map(),
		virtual,
		dirty,
		id,
		filename,
		dir,
		dir_base_path,
		extension,
		content,
		content_buffer,
		content_hash,
		filer_dir,
		build_files: reconstructed_build_files || new Map(),
		stats: undefined,
	};
};

export const assert_source_file: (
	file: BaseFilerFile | undefined | null,
) => asserts file is SourceFile = (file) => {
	if (file == null) {
		throw Error(`Expected a file but got ${file}`);
	}
	if (file.type !== 'source') {
		throw Error(`Expected a source file, but type is ${file.type}: ${file.id}`);
	}
};

export const filter_dependents = (
	source_file: SourceFile,
	build_config: BuildConfig,
	find_file_by_id: (id: string) => SourceFile | undefined,
	filter?: IdFilter | undefined,
	results: Set<string> = new Set(),
	searched: Set<string> = new Set(),
): Set<string> => {
	const dependents_for_config = source_file.dependents?.get(build_config);
	if (!dependents_for_config) return results;
	for (const dependent_id of dependents_for_config.keys()) {
		if (searched.has(dependent_id)) continue;
		searched.add(dependent_id);
		if (!filter || filter(dependent_id)) {
			results.add(dependent_id);
		}
		const dependent_source_file = find_file_by_id(dependent_id)!;
		filter_dependents(
			dependent_source_file,
			build_config,
			find_file_by_id,
			filter,
			results,
			searched,
		);
	}
	return results;
};