import {join, isAbsolute, basename} from 'node:path';
import {stripEnd, stripStart} from '@feltjs/util/string.js';
import {existsSync, statSync} from 'node:fs';

import {
	lib_path_to_import_id,
	replace_root_dir,
	gro_dir_basename,
	gro_paths,
	type Paths,
	LIB_DIR,
	LIB_PATH,
	is_this_project_gro,
} from './paths.js';
import {to_path_data, type PathData, type PathStats} from './path_data.js';

/**
 * Raw input paths are paths that users provide to Gro to reference files
 * enhanced with Gro's conventions like `.test.`, `.task.`, and `.gen.`.
 *
 * A raw input path can be:
 *
 * - a relative path to a file, e.g. `src/foo/bar.test.ts`
 * - a file without an extension, e.g. `src/foo/bar` if `extensions` is `.test.ts`
 * - a directory containing any number of files, e.g. `src/foo`
 * - any of the above without the leading `src/` or with a leading `./`
 * - any of the above but leading with `gro/` to ignore the local directory
 * - an absolute path to a file or directory in the current directory or Gro's
 *
 * The input path API lets the caller customize the allowable extensions.
 * That means that the caller can look for `.test.` files but not `.gen.`,
 * or both, or neither, depending on its needs.
 *
 * In the future we may want to support globbing or regexps.
 */
export const resolve_raw_input_path = (raw_input_path: string): string => {
	if (isAbsolute(raw_input_path)) return stripEnd(raw_input_path, '/');
	// Allow prefix `./` and just remove it if it's there.
	let base_path = stripEnd(stripStart(raw_input_path, './'), '/');
	// To run Gro's base tasks, we resolve from dist/ instead of src/.
	console.log(`resolve_raw_input_path base_path 1`, base_path);
	console.log(`is_this_project_gro`, is_this_project_gro);
	let paths;
	// If it's prefixed with `gro/` or exactly `gro`, use the Gro paths.
	if (is_this_project_gro || (base_path + '/').startsWith(gro_dir_basename)) {
		paths = gro_paths;
		base_path = stripEnd(stripStart(base_path + '/', gro_dir_basename), '/');
	}
	// Handle `src/lib` by itself without conflicting with `src/libFoo` names.
	if (base_path === LIB_PATH) base_path = '';
	// Allow prefix `src/lib/` and just remove it if it's there.
	base_path = stripStart(base_path, LIB_DIR);
	console.log(`resolve_raw_input_path base_path 2`, base_path);
	return lib_path_to_import_id(base_path, paths);
};

export const resolve_raw_input_paths = (raw_input_paths: string[]): string[] =>
	(raw_input_paths.length ? raw_input_paths : ['./']).map((p) => resolve_raw_input_path(p));

/**
 * Gets a list of possible source ids for each input path with `extensions`,
 * duplicating each under `root_dirs`.
 * This is first used to fall back to the Gro dir to search for tasks.
 * It's the helper used in implementations of `get_possible_source_idsForInputPath` below.
 */
export const get_possible_source_ids = (
	input_path: string,
	extensions: string[],
	root_dirs?: string[],
	paths?: Paths,
): string[] => {
	const possible_source_ids = [input_path];
	if (!input_path.endsWith('/')) {
		for (const extension of extensions) {
			if (!input_path.endsWith(extension)) {
				possible_source_ids.push(input_path + extension);
				// Support task directories, so `src/a/a.task.ts` works like `src/a.task.ts`.
				possible_source_ids.push(input_path + '/' + basename(input_path) + extension);
			}
		}
	}
	if (root_dirs?.length) {
		const ids = possible_source_ids.slice(); // make a copy or infinitely loop!
		for (const root_dir of root_dirs) {
			if (input_path.startsWith(root_dir)) continue; // avoid duplicates
			for (const possible_source_id of ids) {
				possible_source_ids.push(replace_root_dir(possible_source_id, root_dir, paths));
			}
		}
	}
	console.log(`possible_source_ids`, input_path, extensions, root_dirs, paths, possible_source_ids);
	return possible_source_ids;
};

/**
 * Gets the path data for each input path,
 * searching for the possibilities based on `extensions`
 * and stopping at the first match.
 * Parameterized by `exists` and `stat` so it's fs-agnostic.
 */
export const load_source_path_data_by_input_path = (
	input_paths: string[],
	get_possible_source_idsForInputPath?: (input_path: string) => string[],
): {
	source_id_path_data_by_input_path: Map<string, PathData>;
	unmapped_input_paths: string[];
} => {
	const source_id_path_data_by_input_path = new Map<string, PathData>();
	const unmapped_input_paths: string[] = [];
	for (const input_path of input_paths) {
		let file_path_data: PathData | null = null;
		let dir_path_data: PathData | null = null;
		const possible_source_ids = get_possible_source_idsForInputPath
			? get_possible_source_idsForInputPath(input_path)
			: [input_path];
		for (const possible_source_id of possible_source_ids) {
			if (!existsSync(possible_source_id)) continue;
			const stats = statSync(possible_source_id);
			if (stats.isDirectory()) {
				if (!dir_path_data) {
					dir_path_data = to_path_data(possible_source_id, stats);
				}
			} else {
				file_path_data = to_path_data(possible_source_id, stats);
				break;
			}
		}
		if (file_path_data || dir_path_data) {
			source_id_path_data_by_input_path.set(input_path, file_path_data || dir_path_data!); // the ! is needed because TypeScript inference fails
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
	source_id_path_data_by_input_path: Map<string, PathData>,
	find_files: (id: string) => Promise<Map<string, PathStats>>,
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
			const files = await find_files(id); // eslint-disable-line no-await-in-loop
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
