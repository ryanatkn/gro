import {Unreachable_Error} from '@feltcoop/felt/util/error.js';

import type {Base_Filer_File} from './base_filer_file.js';
import type {Source_Meta} from './source_meta.js';
import type {Build_Dependency} from './build_dependency.js';
import {basename, dirname, extname} from 'path';
import {load_content} from './load.js';
import type {Build_Config} from '../build/build_config.js';
import type {Filesystem} from '../fs/filesystem.js';

export type Build_File = Text_Build_File | Binary_Build_File;
export interface Text_Build_File extends Base_Build_File {
	readonly encoding: 'utf8';
	readonly content: string;
}
export interface Binary_Build_File extends Base_Build_File {
	readonly encoding: null;
	readonly content: Buffer;
	readonly content_buffer: Buffer;
}
export interface Base_Build_File extends Base_Filer_File {
	readonly type: 'build';
	readonly source_id: string;
	readonly build_config: Build_Config;
	// This data structure de-dupes by build id, because we can throw away
	// the information of duplicate imports to the same dependency within each build file.
	// We may want to store more granular dependency info, including imported identifiers,
	// in the future.
	readonly dependencies_by_build_id: Map<string, Build_Dependency> | null;
}

export const reconstruct_build_files = async (
	fs: Filesystem,
	source_meta: Source_Meta,
	build_configs: readonly Build_Config[],
): Promise<Map<Build_Config, Build_File[]>> => {
	const build_files: Map<Build_Config, Build_File[]> = new Map();
	await Promise.all(
		source_meta.data.builds.map(async (build): Promise<void> => {
			const {id, build_name, dependencies, encoding} = build;
			const filename = basename(id);
			const dir = dirname(id) + '/'; // TODO the slash is currently needed because paths.source_id and the rest have a trailing slash, but this may cause other problems
			const extension = extname(id);
			const content = await load_content(fs, encoding, id);
			const build_config = build_configs.find((b) => b.name === build_name)!; // is a bit awkward, but probably not inefficient enough to change
			if (!build_config) {
				// TODO wait no this build needs to be preserved somehow,
				// otherwise running the filer with different build configs fails to preserve

				// If the build config is not found, just ignore the cached data --
				// if it's stale it won't hurt anything, and will disappear the next `gro clean`,
				// and if the Filer ever runs with that config again, it'll read from the cache.
				// We rely on this behavior to have the separate bootstrap config.
				return;
			}
			let build_file: Build_File;
			switch (encoding) {
				case 'utf8':
					build_file = {
						type: 'build',
						source_id: source_meta.data.source_id,
						build_config,
						dependencies_by_build_id:
							dependencies && new Map(dependencies.map((d) => [d.build_id, d])),
						id,
						filename,
						dir,
						extension,
						encoding,
						content: content as string,
						content_buffer: undefined,
						content_hash: undefined,
						stats: undefined,
						mime_type: undefined,
					};
					break;
				case null:
					build_file = {
						type: 'build',
						source_id: source_meta.data.source_id,
						build_config,
						dependencies_by_build_id:
							dependencies && new Map(dependencies.map((d) => [d.build_id, d])),
						id,
						filename,
						dir,
						extension,
						encoding,
						content: content as Buffer,
						content_buffer: content as Buffer,
						content_hash: undefined,
						stats: undefined,
						mime_type: undefined,
					};
					break;
				default:
					throw new Unreachable_Error(encoding);
			}
			add_build_file(build_file, build_files, build_config);
		}),
	);
	return build_files;
};

const add_build_file = (
	build_file: Build_File,
	build_files: Map<Build_Config, Build_File[]>,
	build_config: Build_Config,
): void => {
	let files = build_files.get(build_config);
	if (files === undefined) {
		files = [];
		build_files.set(build_config, files);
	}
	files.push(build_file);
};

// TODO maybe this should take in cached aggregated data from the source file, not `oldBuild_Files`?

// Returns the dependency changes between two sets of build files.
// Lazily instantiate the collections as a small optimization -
// this function is expected to return `null` most of the time.
export const diff_dependencies = (
	new_files: readonly Build_File[],
	old_files: readonly Build_File[] | null,
): {
	added_dependencies: Build_Dependency[] | null;
	removed_dependencies: Build_Dependency[] | null;
} | null => {
	if (new_files === old_files) return null;
	let added_dependencies: Build_Dependency[] | null = null;
	let removed_dependencies: Build_Dependency[] | null = null;

	// Aggregate all of the dependencies for each source file. The map de-dupes by build id.
	let new_dependencies: Map<string, Build_Dependency> | null = null;
	let old_dependencies: Map<string, Build_Dependency> | null = null;
	for (const new_file of new_files) {
		if (new_file.dependencies_by_build_id !== null) {
			for (const dependency of new_file.dependencies_by_build_id.values()) {
				if (new_dependencies === null) new_dependencies = new Map();
				if (!new_dependencies.has(dependency.build_id)) {
					new_dependencies.set(dependency.build_id, dependency);
				}
			}
		}
	}
	if (old_files !== null) {
		for (const old_file of old_files) {
			if (old_file.dependencies_by_build_id !== null) {
				for (const dependency of old_file.dependencies_by_build_id.values()) {
					if (old_dependencies === null) old_dependencies = new Map();
					if (!old_dependencies.has(dependency.build_id)) {
						old_dependencies.set(dependency.build_id, dependency);
					}
				}
			}
		}
	}

	// Figure out which dependencies were added and removed.
	if (new_dependencies !== null) {
		for (const new_dependency of new_dependencies.values()) {
			if (old_dependencies === null || !old_dependencies.has(new_dependency.build_id)) {
				if (added_dependencies === null) added_dependencies = [];
				added_dependencies.push(new_dependency);
			}
		}
	}
	if (old_dependencies !== null) {
		for (const old_dependency of old_dependencies.values()) {
			if (new_dependencies === null || !new_dependencies.has(old_dependency.build_id)) {
				if (removed_dependencies === null) removed_dependencies = [];
				removed_dependencies.push(old_dependency);
			}
		}
	}

	return added_dependencies !== null || removed_dependencies !== null
		? {added_dependencies, removed_dependencies}
		: null;
};
