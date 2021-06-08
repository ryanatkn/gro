import {join, sep, isAbsolute} from 'path';
import {strip_start} from '@feltcoop/felt/util/string.js';

import {
	base_path_to_source_id,
	SOURCE_DIR,
	SOURCE_DIRNAME,
	replace_root_dir,
	gro_dir_basename,
	gro_paths,
} from '../paths.js';
import type {Paths} from '../paths.js';
import {toPath_Data} from './path_data.js';
import type {Path_Data, Path_Stats} from './path_data.js';
import type {Filesystem} from './filesystem.js';

/*

Raw input paths are paths that users provide to Gro to reference files
enhanced with Gro's conventions like `.test.`, `.task.`, and `.gen.`.

A raw input path can be:

- a relative path to a file, e.g. `src/foo/bar.test.ts`
- a file without an extension, e.g. `src/foo/bar` if `extensions` is `.test.ts`
- a directory containing any number of files, e.g. `src/foo`
- any of the above without the leading `src/` or with a leading `./`
- any of the above but leading with `gro/` to ignore the local directory
- an absolute path to a file or directory in the current directory or Gro's

The input path API lets the caller customize the allowable extensions.
That means that the caller can look for `.test.` files but not `.gen.`,
or both, or neither, depending on its needs.

In the future we may want to support globbing or regexps.

*/
export const resolve_raw_input_path = (rawInputPath: string, from_paths?: Paths): string => {
	if (isAbsolute(rawInputPath)) return rawInputPath;
	// Allow prefix `./` and just remove it if it's there.
	let base_path = strip_start(rawInputPath, './');
	if (!from_paths) {
		// If it's prefixed with `gro/` or exactly `gro`, use the Gro paths.
		if (base_path.startsWith(gro_dir_basename)) {
			from_paths = gro_paths;
			base_path = strip_start(base_path, gro_dir_basename);
		} else if (base_path + sep === gro_dir_basename) {
			from_paths = gro_paths;
			base_path = '';
		}
	}
	// Handle `src` by itself without conflicting with `srcFoo` names.
	if (base_path === SOURCE_DIRNAME) base_path = '';
	// Allow prefix `src/` and just remove it if it's there.
	base_path = strip_start(base_path, SOURCE_DIR);
	return base_path_to_source_id(base_path, from_paths);
};

export const resolve_raw_input_paths = (rawInputPaths: string[]): string[] =>
	(rawInputPaths.length ? rawInputPaths : ['./']).map((p) => resolve_raw_input_path(p));

/*

Gets a list of possible source ids for each input path with `extensions`,
duplicating each under `root_dirs`.
This is first used to fall back to the Gro dir to search for tasks.
It's the helper used in implementations of `get_possible_source_idsForInputPath` below.

*/
export const get_possible_source_ids = (
	input_path: string,
	extensions: string[],
	root_dirs: string[] = [],
	paths?: Paths,
): string[] => {
	const possibleSourceIds = [input_path];
	if (!input_path.endsWith(sep)) {
		for (const extension of extensions) {
			if (!input_path.endsWith(extension)) {
				possibleSourceIds.push(input_path + extension);
			}
		}
	}
	if (root_dirs.length) {
		const ids = possibleSourceIds.slice(); // make a copy or infinitely loop!
		for (const root_dir of root_dirs) {
			if (input_path.startsWith(root_dir)) continue; // avoid duplicates
			for (const possibleSourceId of ids) {
				possibleSourceIds.push(replace_root_dir(possibleSourceId, root_dir, paths));
			}
		}
	}
	return possibleSourceIds;
};

/*

Gets the path data for each input path,
searching for the possibilities based on `extensions`
and stopping at the first match.
Parameterized by `exists` and `stat` so it's fs-agnostic.

*/
export const load_source_path_data_by_input_path = async (
	fs: Filesystem,
	input_paths: string[],
	get_possible_source_idsForInputPath?: (input_path: string) => string[],
): Promise<{
	source_id_path_data_by_input_path: Map<string, Path_Data>;
	unmappedInputPaths: string[];
}> => {
	const source_id_path_data_by_input_path = new Map<string, Path_Data>();
	const unmappedInputPaths: string[] = [];
	for (const input_path of input_paths) {
		let filePath_Data: Path_Data | null = null;
		let dirPath_Data: Path_Data | null = null;
		const possibleSourceIds = get_possible_source_idsForInputPath
			? get_possible_source_idsForInputPath(input_path)
			: [input_path];
		for (const possibleSourceId of possibleSourceIds) {
			if (!(await fs.exists(possibleSourceId))) continue;
			const stats = await fs.stat(possibleSourceId);
			if (stats.isDirectory()) {
				if (!dirPath_Data) {
					dirPath_Data = toPath_Data(possibleSourceId, stats);
				}
			} else {
				filePath_Data = toPath_Data(possibleSourceId, stats);
				break;
			}
		}
		if (filePath_Data || dirPath_Data) {
			source_id_path_data_by_input_path.set(input_path, filePath_Data || dirPath_Data!); // the ! is needed because TypeScript inference fails
		} else {
			unmappedInputPaths.push(input_path);
		}
	}
	return {source_id_path_data_by_input_path, unmappedInputPaths};
};

/*

Finds all of the matching files for the given input paths.
Parameterized by `find_files` so it's fs-agnostic.
De-dupes source ids.

*/
export const load_source_ids_by_input_path = async (
	source_id_path_data_by_input_path: Map<string, Path_Data>,
	find_files: (id: string) => Promise<Map<string, Path_Stats>>,
): Promise<{
	source_ids_by_input_path: Map<string, string[]>;
	input_directories_with_no_files: string[];
}> => {
	const source_ids_by_input_path = new Map<string, string[]>();
	const input_directories_with_no_files: string[] = [];
	const existingSourceIds = new Set<string>();
	for (const [input_path, path_data] of source_id_path_data_by_input_path) {
		if (path_data.is_directory) {
			const files = await find_files(path_data.id);
			if (files.size) {
				let source_ids: string[] = [];
				let hasFiles = false;
				for (const [path, stats] of files) {
					if (!stats.isDirectory()) {
						hasFiles = true;
						const source_id = join(path_data.id, path);
						if (!existingSourceIds.has(source_id)) {
							existingSourceIds.add(source_id);
							source_ids.push(source_id);
						}
					}
				}
				if (source_ids.length) {
					source_ids_by_input_path.set(input_path, source_ids);
				}
				if (!hasFiles) {
					input_directories_with_no_files.push(input_path);
				}
				// do callers ever need `inputDirectoriesWithDuplicateFiles`?
			} else {
				input_directories_with_no_files.push(input_path);
			}
		} else {
			if (!existingSourceIds.has(path_data.id)) {
				existingSourceIds.add(path_data.id);
				source_ids_by_input_path.set(input_path, [path_data.id]);
			}
		}
	}
	return {source_ids_by_input_path, input_directories_with_no_files};
};
