import {isAbsolute, join, resolve} from 'node:path';
import {strip_start} from '@ryanatkn/belt/string.js';
import {stat} from 'node:fs/promises';
import {z} from 'zod';
import type {Flavored} from '@ryanatkn/belt/types.js';

import {GRO_PACKAGE_DIR, GRO_DIST_DIR} from './paths.js';
import {to_path_data, type Path_Data, type Path_Id} from './path.js';
import {exists} from './fs.js';
import {search_fs} from './search_fs.js';
import {TASK_FILE_SUFFIX_JS} from './task.js';

// TODO Flavored doesn't work when used in schemas, use Zod brand instead? problem is ergonomics
export const Input_Path = z.string();
export type Input_Path = Flavored<z.infer<typeof Input_Path>, 'Input_Path'>;

export const Raw_Input_Path = z.string();
export type Raw_Input_Path = Flavored<z.infer<typeof Raw_Input_Path>, 'Raw_Input_Path'>;

/**
 * Raw input paths are paths that users provide to Gro to reference files for tasks and gen.
 *
 * A raw input path can be to a file or directory in the following forms:
 *
 * - an absolute path, preserved
 * - an explicit relative path, e.g. `./src/foo`, resolved to `root_path` which defaults to the cwd
 * - an implicit relative path, e.g. `src/foo`, preserved
 * - an implicit relative path prefixed with `gro/`, transformed to absolute in the Gro directory
 *
 * Thus, input paths are either absolute or implicitly relative.
 */
export const to_input_path = (
	raw_input_path: Raw_Input_Path,
	root_path = process.cwd(),
): Input_Path => {
	if (raw_input_path.startsWith(GRO_PACKAGE_DIR)) {
		return GRO_DIST_DIR + strip_start(raw_input_path, GRO_PACKAGE_DIR);
	} else if (raw_input_path[0] === '.') {
		return resolve(root_path, raw_input_path);
	}
	return raw_input_path as Input_Path;
};

export const to_input_paths = (
	raw_input_paths: Raw_Input_Path[],
	root_path?: string,
): Input_Path[] => raw_input_paths.map((p) => to_input_path(p, root_path));

export interface Possible_Path {
	id: Path_Id;
	input_path: Input_Path;
	root_dir: Path_Id | null;
}

/**
 * Gets a list of possible source ids for each input path with `extensions`,
 * duplicating each under `root_dirs`.
 * This is first used to fall back to the Gro dir to search for tasks.
 * It's the helper used in implementations of `get_possible_paths_for_input_path` below.
 */
export const get_possible_paths = (
	input_path: Input_Path,
	root_dirs: Path_Id[],
	extensions: string[],
): Possible_Path[] => {
	const possible_paths: Set<Possible_Path> = new Set();

	const add_possible_paths = (path: string, root_dir: Path_Id | null) => {
		// Specifically for paths to the Gro package dist, optimize by only looking for `.task.js`.
		if (path.startsWith(GRO_DIST_DIR)) {
			possible_paths.add({
				id: (path.endsWith('/') || path.endsWith(TASK_FILE_SUFFIX_JS)
					? path
					: path + TASK_FILE_SUFFIX_JS) as Path_Id,
				input_path,
				root_dir,
			});
		} else {
			possible_paths.add({id: path as Path_Id, input_path, root_dir});
			if (!path.endsWith('/') && !extensions.some((e) => path.endsWith(e))) {
				for (const extension of extensions) {
					possible_paths.add({id: path + extension, input_path, root_dir});
				}
			}
		}
	};

	if (isAbsolute(input_path)) {
		add_possible_paths(input_path, null);
	} else {
		for (const root_dir of root_dirs) {
			add_possible_paths(join(root_dir, input_path), root_dir);
		}
	}
	return Array.from(possible_paths);
};

export interface Resolved_Input_Path {
	input_path: Input_Path;
	id: Path_Id;
	is_directory: boolean;
	root_dir: Path_Id | null;
	possible_paths: Possible_Path[];
}

export interface Resolved_Input_File {
	id: Path_Id;
	input_path: Input_Path;
	resolved_input_path: Resolved_Input_Path;
}

/**
 * Gets the path data for each input path, checking the filesystem for the possibilities
 * and stopping at the first existing file or falling back to the first existing directory.
 * If none is found for an input path, it's added to `unmapped_input_paths`.
 */
export const resolve_input_paths = async (
	input_paths: Input_Path[],
	root_dirs: Path_Id[],
	extensions: string[],
): Promise<{
	resolved_input_paths: Resolved_Input_Path[];
	unmapped_input_paths: Input_Path[];
}> => {
	console.log(`[resolve_input_paths]`, input_paths);
	const resolved_input_paths: Resolved_Input_Path[] = [];
	const unmapped_input_paths: Input_Path[] = [];
	const possible_paths_by_input_path = new Map<Input_Path, Possible_Path[]>();
	for (const input_path of input_paths) {
		let found_file_data: [Path_Data, Possible_Path] | null = null;
		let found_dir_data: [Path_Data, Possible_Path] | null = null;
		const possible_paths = get_possible_paths(input_path, root_dirs, extensions);
		possible_paths_by_input_path.set(input_path, possible_paths);

		// Find the first existing file path or fallback to the first directory path.
		for (const possible_path of possible_paths) {
			if (!(await exists(possible_path.id))) continue; // eslint-disable-line no-await-in-loop
			const stats = await stat(possible_path.id); // eslint-disable-line no-await-in-loop
			if (stats.isDirectory()) {
				if (found_dir_data) continue;
				found_dir_data = [to_path_data(possible_path.id, stats), possible_path];
			} else {
				found_file_data = [to_path_data(possible_path.id, stats), possible_path];
				break;
			}
		}
		const found = found_file_data || found_dir_data;
		if (found) {
			resolved_input_paths.push({
				input_path,
				id: found[0].id,
				is_directory: found[0].is_directory,
				root_dir: found[1].root_dir,
				possible_paths,
			});
		} else {
			unmapped_input_paths.push(input_path);
		}
	}
	return {
		resolved_input_paths,
		unmapped_input_paths,
	};
};

/**
 * Finds all of the matching files for the given input paths.
 * De-dupes source ids.
 */
export const resolve_input_files = async (
	resolved_input_paths: Resolved_Input_Path[],
	custom_search_fs = search_fs,
): Promise<{
	resolved_input_files: Resolved_Input_File[];
	resolved_input_files_by_input_path: Map<Input_Path, Resolved_Input_File[]>;
	input_directories_with_no_files: Resolved_Input_Path[];
}> => {
	const resolved_input_files: Resolved_Input_File[] = [];
	const resolved_input_files_by_input_path = new Map<Input_Path, Resolved_Input_File[]>();
	const input_directories_with_no_files: Resolved_Input_Path[] = [];
	const existing_path_ids = new Set<Path_Id>();
	// TODO parallelize but would need to de-dupe and retain order
	for (const resolved_input_path of resolved_input_paths) {
		const {input_path, id, is_directory} = resolved_input_path;
		if (is_directory) {
			const files = await custom_search_fs(id, {files_only: false}); // eslint-disable-line no-await-in-loop
			if (files.size) {
				const path_ids: Path_Id[] = [];
				let has_files = false;
				for (const [path, stats] of files) {
					if (stats.isDirectory()) continue;
					has_files = true;
					const path_id = join(id, path);
					if (!existing_path_ids.has(path_id)) {
						existing_path_ids.add(path_id);
						path_ids.push(path_id);
					}
				}
				if (path_ids.length) {
					const resolved_input_files_for_input_path: Resolved_Input_File[] = [];
					for (const path_id of path_ids) {
						const resolved_input_file: Resolved_Input_File = {
							id: path_id,
							input_path,
							resolved_input_path,
						};
						resolved_input_files.push(resolved_input_file);
						resolved_input_files_for_input_path.push(resolved_input_file);
					}
					resolved_input_files_by_input_path.set(input_path, resolved_input_files_for_input_path);
				}
				if (!has_files) {
					input_directories_with_no_files.push(resolved_input_path);
				}
				// do callers ever need `input_directories_with_duplicate_files`?
			} else {
				input_directories_with_no_files.push(resolved_input_path);
			}
		} else if (!existing_path_ids.has(id)) {
			existing_path_ids.add(id);
			const resolved_input_file: Resolved_Input_File = {id, input_path, resolved_input_path};
			resolved_input_files.push(resolved_input_file);
			resolved_input_files_by_input_path.set(input_path, [resolved_input_file]);
		}
	}
	return {
		resolved_input_files,
		resolved_input_files_by_input_path,
		input_directories_with_no_files,
	};
};
