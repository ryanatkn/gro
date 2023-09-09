import {readFileSync} from 'node:fs';

import type {BaseFilerFile} from './filer_file.js';
import type {SourceMeta} from './source_meta.js';
import type {BuildDependency} from './build_dependency.js';
import {basename, dirname, extname} from 'node:path';
import type {BuildConfig} from './build_config.js';
import type {BuildId, SourceId} from '../path/paths.js';

export interface BuildFile extends BaseFilerFile {
	readonly id: BuildId;
	readonly type: 'build';
	readonly source_id: SourceId;
	readonly build_config: BuildConfig;
	// This data structure de-dupes by build id, because we can throw away
	// the information of duplicate imports to the same dependency within each build file.
	// We may want to store more granular dependency info, including imported identifiers,
	// in the future.
	readonly dependencies: Map<BuildId, BuildDependency> | null;
}

export const reconstruct_build_files = async (
	source_meta: SourceMeta,
	build_configs: readonly BuildConfig[],
): Promise<Map<BuildConfig, BuildFile[]>> => {
	const build_files: Map<BuildConfig, BuildFile[]> = new Map();
	await Promise.all(
		source_meta.data.builds.map(async (build): Promise<void> => {
			const {id, build_name, dependencies} = build;
			const filename = basename(id);
			const dir = dirname(id) + '/'; // TODO the slash is currently needed because paths.source_id and the rest have a trailing slash, but this may cause other problems
			const extension = extname(id);
			const content = readFileSync(id, 'utf8');
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
			const build_file: BuildFile = {
				type: 'build',
				source_id: source_meta.data.source_id,
				build_config,
				dependencies: dependencies && new Map(dependencies.map((d) => [d.build_id, d])),
				id,
				filename,
				dir,
				extension,
				content: content as string,
				content_buffer: undefined,
				content_hash: undefined,
				stats: undefined,
			};
			add_build_file(build_file, build_files, build_config);
		}),
	);
	return build_files;
};

const add_build_file = (
	build_file: BuildFile,
	build_files: Map<BuildConfig, BuildFile[]>,
	build_config: BuildConfig,
): void => {
	let files = build_files.get(build_config);
	if (files === undefined) {
		files = [];
		build_files.set(build_config, files);
	}
	files.push(build_file);
};

// TODO maybe this should take in cached aggregated data from the source file, not `old_build_files`?

// Returns the dependency changes between two sets of build files.
// Lazily instantiate the collections as a small optimization -
// this function is expected to return `null` most of the time.
export const diff_dependencies = (
	new_files: readonly BuildFile[],
	old_files: readonly BuildFile[] | null,
): {
	added_dependencies: BuildDependency[] | null;
	removed_dependencies: BuildDependency[] | null;
} | null => {
	if (new_files === old_files) return null;
	let added_dependencies: BuildDependency[] | null = null;
	let removed_dependencies: BuildDependency[] | null = null;

	// Aggregate all of the dependencies for each source file. The maps de-dupe by build id.
	let new_dependencies: Map<BuildId, BuildDependency> | null = null;
	let old_dependencies: Map<BuildId, BuildDependency> | null = null;
	for (const new_file of new_files) {
		if (new_file.dependencies !== null) {
			for (const dependency of new_file.dependencies.values()) {
				if (new_dependencies === null) new_dependencies = new Map();
				if (!new_dependencies.has(dependency.build_id)) {
					new_dependencies.set(dependency.build_id, dependency);
				}
			}
		}
	}
	if (old_files !== null) {
		for (const old_file of old_files) {
			if (old_file.dependencies !== null) {
				for (const dependency of old_file.dependencies.values()) {
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
