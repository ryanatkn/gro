import {dirname, isAbsolute, join, resolve} from 'node:path';
import {existsSync, statSync} from 'node:fs';
import {strip_start} from '@ryanatkn/belt/string.js';
import {z} from 'zod';
import type {Flavored} from '@ryanatkn/belt/types.js';

import {GRO_PACKAGE_DIR, GRO_DIST_DIR} from './paths.js';
import type {Path_Info, Path_Id, Resolved_Path} from './path.js';
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
	root_path = process.cwd(), // TODO @multiple isn't passed in anywhere, maybe hoist to `invoke_task` and others
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
	root_path?: string, // TODO @multiple isn't passed in anywhere, maybe hoist to `invoke_task` and others
): Input_Path[] => raw_input_paths.map((p) => to_input_path(p, root_path));

export interface Possible_Path {
	id: Path_Id;
	input_path: Input_Path;
	root_dir: Path_Id;
}

/**
 * Gets a list of possible source ids for each input path with `extensions`,
 * duplicating each under `root_dirs`, without checking the filesystem.
 */
export const get_possible_paths = (
	input_path: Input_Path,
	root_dirs: Path_Id[],
	extensions: string[],
): Possible_Path[] => {
	const possible_paths: Set<Possible_Path> = new Set();

	const add_possible_paths = (path: string, root_dir: Path_Id) => {
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
		// TODO this is hacky because it's the only place we're using sync fs calls (even if they're faster, it's oddly inconsistent),
		// we probably should just change this function to check the filesystem and not return non-existing paths
		add_possible_paths(
			input_path,
			existsSync(input_path) && statSync(input_path).isDirectory()
				? input_path
				: dirname(input_path),
		);
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
	root_dir: Path_Id;
}

export interface Resolved_Input_File {
	id: Path_Id;
	input_path: Input_Path;
	resolved_input_path: Resolved_Input_Path;
}

export interface Resolved_Input_Paths {
	resolved_input_paths: Resolved_Input_Path[];
	possible_paths_by_input_path: Map<Input_Path, Possible_Path[]>;
	unmapped_input_paths: Input_Path[];
}

/**
 * Gets the path data for each input path, checking the filesystem for the possibilities
 * and stopping at the first existing file or falling back to the first existing directory.
 * If none is found for an input path, it's added to `unmapped_input_paths`.
 */
export const resolve_input_paths = (
	input_paths: Input_Path[],
	root_dirs: Path_Id[],
	extensions: string[],
): Resolved_Input_Paths => {
	const resolved_input_paths: Resolved_Input_Path[] = [];
	const possible_paths_by_input_path: Map<Input_Path, Possible_Path[]> = new Map();
	const unmapped_input_paths: Input_Path[] = [];
	for (const input_path of input_paths) {
		let found_file: [Path_Info, Possible_Path] | null = null;
		let found_dirs: Array<[Path_Info, Possible_Path]> | null = null;
		const possible_paths = get_possible_paths(input_path, root_dirs, extensions);
		possible_paths_by_input_path.set(input_path, possible_paths);

		// Find the first existing file path or fallback to the first directory path.
		for (const possible_path of possible_paths) {
			if (!existsSync(possible_path.id)) continue;
			const stats = statSync(possible_path.id);
			if (stats.isDirectory()) {
				found_dirs ??= [];
				found_dirs.push([{id: possible_path.id, is_directory: stats.isDirectory()}, possible_path]);
			} else {
				found_file = [{id: possible_path.id, is_directory: stats.isDirectory()}, possible_path];
				break;
			}
		}
		if (found_file) {
			resolved_input_paths.push({
				input_path,
				id: found_file[0].id,
				is_directory: found_file[0].is_directory,
				root_dir: found_file[1].root_dir,
			});
		} else if (found_dirs) {
			for (const found_dir of found_dirs) {
				resolved_input_paths.push({
					input_path,
					id: found_dir[0].id,
					is_directory: found_dir[0].is_directory,
					root_dir: found_dir[1].root_dir,
				});
			}
		} else {
			unmapped_input_paths.push(input_path);
		}
	}
	return {
		resolved_input_paths,
		possible_paths_by_input_path,
		unmapped_input_paths,
	};
};

export interface Resolved_Input_Files {
	resolved_input_files: Resolved_Input_File[];
	resolved_input_files_by_root_dir: Map<Path_Id, Resolved_Input_File[]>;
	input_directories_with_no_files: Input_Path[];
}

/**
 * Finds all of the matching files for the given input paths.
 * De-dupes source ids.
 */
export const resolve_input_files = (
	resolved_input_paths: Resolved_Input_Path[],
	search: (dir: string) => Resolved_Path[] = search_fs,
): Resolved_Input_Files => {
	const resolved_input_files: Resolved_Input_File[] = [];
	// Add all input paths initially, and remove each when resolved to a file.
	const existing_path_ids: Set<Path_Id> = new Set();

	let remaining = resolved_input_paths.slice();
	const handle_found = (input_path: Input_Path, id: Path_Id) => {
		remaining = remaining.filter(
			(r) => !(r.id === id || r.input_path === input_path || r.input_path === id), // `r.input_path === id` may be unnecessary
		);
	};

	// TODO parallelize but would need to de-dupe and retain order
	for (const resolved_input_path of resolved_input_paths) {
		const {input_path, id, is_directory} = resolved_input_path;
		if (is_directory) {
			// Handle input paths that resolve to directories.
			const files = search(id);
			if (!files.length) continue;
			const path_ids: Path_Id[] = [];
			for (const {path, is_directory} of files) {
				if (is_directory) continue;
				const path_id = join(id, path);
				if (!existing_path_ids.has(path_id)) {
					existing_path_ids.add(path_id);
					path_ids.push(path_id);
				}
				handle_found(input_path, path_id);
			}
			if (!path_ids.length) continue;
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
		} else {
			if (!existing_path_ids.has(id)) {
				// Handle input paths that resolve to files.
				existing_path_ids.add(id);
				const resolved_input_file: Resolved_Input_File = {id, input_path, resolved_input_path};
				resolved_input_files.push(resolved_input_file);
			}
			handle_found(input_path, id);
		}
	}
	return {
		resolved_input_files,
		resolved_input_files_by_root_dir: resolved_input_files.reduce((map, resolved_input_file) => {
			const {root_dir} = resolved_input_file.resolved_input_path;
			if (map.has(root_dir)) {
				map.get(root_dir)!.push(resolved_input_file);
			} else {
				map.set(root_dir, [resolved_input_file]);
			}
			return map;
		}, new Map<Path_Id, Resolved_Input_File[]>()),
		input_directories_with_no_files: remaining.map((r) => r.input_path),
	};
};
