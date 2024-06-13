import {join, isAbsolute, resolve} from 'node:path';
import {strip_end, strip_start} from '@ryanatkn/belt/string.js';
import {stat} from 'node:fs/promises';

import {
	replace_root_dir,
	GRO_PACKAGE_DIR,
	gro_paths,
	LIB_DIR,
	LIB_PATH,
	GRO_SVELTEKIT_DIST_DIR,
	paths,
	type Paths,
	LIB_DIRNAME,
	base_path_to_source_id,
} from './paths.js';
import {to_path_data, type Path_Data} from './path.js';
import {exists} from './fs.js';
import {search_fs} from './search_fs.js';

/**
 * Raw input paths are paths that users provide to Gro to reference files for tasks and gen.
 *
 * A raw input path can be:
 *
 * - an absolute path to a file or directory
 * - an explicit relative path to a file, e.g. `./src/foo`
 * - an implicit relative path to a file, e.g. `src/foo`
 * - a directory containing any number of files, e.g. `src/foo`
 * - any of the above but leading with `gro/` to ignore the local directory
 *
 */
export const resolve_input_path = (raw_input_path: string): string => {
	// TODO maybe stripping `'/'` is not the right thing, but normally doesn't matter because all usage is with files with extensions
	if (isAbsolute(raw_input_path)) return strip_end(raw_input_path, '/');
	if (raw_input_path[0] === '.') return strip_end(resolve(raw_input_path), '/');
	let path = strip_end(raw_input_path, '/');
	let paths: Paths | undefined;
	// If it's prefixed with `gro/` or exactly `gro`, use the Gro paths.
	if ((path + '/').startsWith(GRO_PACKAGE_DIR)) {
		paths = gro_paths;
		path = strip_end(strip_start(path + '/', GRO_PACKAGE_DIR), '/');
	}
	// Handle `src/lib` by itself without conflicting with `src/libFoo` names.
	if (path === LIB_PATH) path = ''; // TODO @multiple get from the sveltekit config
	// Allow prefix `src/lib/` and just remove it if it's there.
	path = strip_start(path, LIB_DIR);
	// TODO BLOCK hardcoded lib above and below
	return base_path_to_source_id(LIB_DIRNAME + '/' + path, paths);
};

export const resolve_input_paths = (raw_input_paths?: string[]): string[] =>
	raw_input_paths?.length ? raw_input_paths.map((p) => resolve_input_path(p)) : [paths.source];

/**
 * Gets a list of possible source ids for each input path with `extensions`,
 * duplicating each under `root_dirs`.
 * This is first used to fall back to the Gro dir to search for tasks.
 * It's the helper used in implementations of `get_possible_source_ids_for_input_path` below.
 */
export const get_possible_source_ids = (
	input_path: string,
	extensions: string[],
	root_dirs?: string[],
): string[] => {
	const possible_source_ids = [input_path];
	if (!input_path.endsWith('/')) {
		for (const extension of extensions) {
			if (!input_path.endsWith(extension)) {
				possible_source_ids.push(input_path + extension);
			}
		}
	}
	if (root_dirs?.length) {
		const ids = possible_source_ids.slice(); // make a copy or infinitely loop!
		for (const root_dir of root_dirs) {
			if (input_path.startsWith(root_dir)) continue; // avoid duplicates
			const is_gro_dist = root_dir === GRO_SVELTEKIT_DIST_DIR; // TODO hacky to handle Gro importing its JS tasks from dist/
			for (const possible_source_id of ids) {
				if (is_gro_dist && !possible_source_id.endsWith('.js')) continue;
				// TODO hacky to handle Gro importing its JS tasks from dist/
				possible_source_ids.push(
					is_gro_dist
						? GRO_SVELTEKIT_DIST_DIR + strip_start(possible_source_id, paths.lib)
						: replace_root_dir(possible_source_id, root_dir, paths),
				);
			}
		}
	}
	return possible_source_ids;
};

/**
 * Gets the path data for each input path,
 * searching for the possibilities based on `extensions`
 * and stopping at the first match.
 * Parameterized by `exists` and `stat` so it's fs-agnostic.
 */
export const load_source_path_data_by_input_path = async (
	input_paths: string[],
	get_possible_source_ids_for_input_path?: (input_path: string) => string[],
): Promise<{
	source_id_path_data_by_input_path: Map<string, Path_Data>;
	unmapped_input_paths: string[];
}> => {
	const source_id_path_data_by_input_path = new Map<string, Path_Data>();
	const unmapped_input_paths: string[] = [];
	for (const input_path of input_paths) {
		console.log(`load_source_path_data_by_input_path input_path`, input_path);
		let file_path_data: Path_Data | null = null;
		let dir_path_data: Path_Data | null = null;
		const possible_source_ids = get_possible_source_ids_for_input_path
			? get_possible_source_ids_for_input_path(input_path)
			: [input_path];
		console.log(`possible_source_ids`, possible_source_ids);
		for (const possible_source_id of possible_source_ids) {
			if (!(await exists(possible_source_id))) continue; // eslint-disable-line no-await-in-loop
			const stats = await stat(possible_source_id); // eslint-disable-line no-await-in-loop
			if (stats.isDirectory()) {
				if (!dir_path_data) {
					dir_path_data = to_path_data(possible_source_id, stats);
				}
			} else {
				file_path_data = to_path_data(possible_source_id, stats);
				break;
			}
		}
		const path_data = file_path_data || dir_path_data;
		if (path_data) {
			source_id_path_data_by_input_path.set(input_path, path_data);
		} else {
			unmapped_input_paths.push(input_path);
		}
	}
	return {source_id_path_data_by_input_path, unmapped_input_paths};
};

/**
 * Finds all of the matching files for the given input paths.
 * Parameterized by `find_files` so it's fs-agnostic.
 * De-dupes source ids.
 */
export const load_source_ids_by_input_path = async (
	source_id_path_data_by_input_path: Map<string, Path_Data>,
	custom_search_fs = search_fs,
): Promise<{
	source_ids_by_input_path: Map<string, string[]>;
	input_directories_with_no_files: string[];
}> => {
	const source_ids_by_input_path = new Map<string, string[]>();
	const input_directories_with_no_files: string[] = [];
	const existing_source_ids = new Set<string>();
	for (const [input_path, path_data] of source_id_path_data_by_input_path) {
		const {id} = path_data;
		if (path_data.isDirectory) {
			const files = await custom_search_fs(id, {files_only: false}); // eslint-disable-line no-await-in-loop
			if (files.size) {
				const source_ids: string[] = [];
				let has_files = false;
				for (const path of files.keys()) {
					has_files = true;
					const source_id = join(id, path);
					if (!existing_source_ids.has(source_id)) {
						existing_source_ids.add(source_id);
						source_ids.push(source_id);
					}
				}
				if (source_ids.length) {
					source_ids_by_input_path.set(input_path, source_ids);
				}
				if (!has_files) {
					input_directories_with_no_files.push(input_path);
				}
				// do callers ever need `inputDirectoriesWithDuplicateFiles`?
			} else {
				input_directories_with_no_files.push(input_path);
			}
		} else if (!existing_source_ids.has(id)) {
			existing_source_ids.add(id);
			source_ids_by_input_path.set(input_path, [id]);
		}
	}
	return {source_ids_by_input_path, input_directories_with_no_files};
};
