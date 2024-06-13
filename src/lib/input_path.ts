import {join, resolve} from 'node:path';
import {strip_start} from '@ryanatkn/belt/string.js';
import {stat} from 'node:fs/promises';
import {z} from 'zod';
import type {Flavored} from '@ryanatkn/belt/types.js';

import {
	replace_root_dir,
	GRO_PACKAGE_DIR,
	GRO_SVELTEKIT_DIST_DIR,
	paths,
	Source_Id,
} from './paths.js';
import {to_path_data, type Path_Data} from './path.js';
import {exists} from './fs.js';
import {search_fs} from './search_fs.js';
import {blue, red} from 'kleur/colors';

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
 */
export const to_input_path = (
	raw_input_path: Raw_Input_Path,
	root_path = process.cwd(),
): Input_Path => {
	if (raw_input_path.startsWith(GRO_PACKAGE_DIR)) {
		return GRO_SVELTEKIT_DIST_DIR + strip_start(raw_input_path, GRO_PACKAGE_DIR);
	} else if (raw_input_path[0] === '.') {
		return resolve(root_path, raw_input_path);
	}
	return raw_input_path as Input_Path;
};

export const to_input_paths = (
	raw_input_paths: Raw_Input_Path[],
	root_path?: string,
): Input_Path[] => raw_input_paths.map((p) => to_input_path(p, root_path));

/**
 * Gets a list of possible source ids for each input path with `extensions`,
 * duplicating each under `root_dirs`.
 * This is first used to fall back to the Gro dir to search for tasks.
 * It's the helper used in implementations of `get_possible_source_ids_for_input_path` below.
 */
export const get_possible_source_ids = (
	input_path: Input_Path,
	extensions: string[],
	root_dirs?: string[],
): Source_Id[] => {
	console.log(red(`[get_possible_source_ids]`), `input_path`, input_path);
	console.log(red(`[get_possible_source_ids]`), `extensions`, extensions);
	console.log(red(`[get_possible_source_ids]`), `root_dirs`, root_dirs);
	const possible_source_ids: Source_Id[] = [input_path as Source_Id];
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
	console.log(red(`[get_possible_source_ids]`), `possible_source_ids`, possible_source_ids);
	return possible_source_ids;
};

/**
 * Gets the path data for each input path, checking the filesystem for the possibilities
 * and stopping at the first existing file or falling back to the first existing directory.
 */
export const load_source_path_data_by_input_path = async (
	input_paths: Input_Path[],
	get_possible_source_ids_for_input_path?: (input_path: Input_Path) => Source_Id[],
): Promise<{
	source_id_path_data_by_input_path: Map<Input_Path, Path_Data>;
	unmapped_input_paths: Input_Path[];
}> => {
	const source_id_path_data_by_input_path = new Map<Input_Path, Path_Data>();
	const unmapped_input_paths: Input_Path[] = [];
	for (const input_path of input_paths) {
		console.log(blue(`[load_source_path_data_by_input_path]`), `input_path`, input_path);
		let file_path_data: Path_Data | null = null;
		let dir_path_data: Path_Data | null = null;
		const possible_source_ids = get_possible_source_ids_for_input_path
			? get_possible_source_ids_for_input_path(input_path)
			: [input_path];
		console.log(
			blue(`[load_source_path_data_by_input_path]`),
			` possible_source_ids`,
			possible_source_ids,
		);
		// Find the first existing file path or fallback to the first directory path.
		for (const possible_source_id of possible_source_ids) {
			if (!(await exists(possible_source_id))) continue; // eslint-disable-line no-await-in-loop
			const stats = await stat(possible_source_id); // eslint-disable-line no-await-in-loop
			if (stats.isDirectory()) {
				if (dir_path_data) continue;
				dir_path_data = to_path_data(possible_source_id, stats);
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
	console.log(
		blue(`[load_source_path_data_by_input_path]`),
		` source_id_path_data_by_input_path`,
		source_id_path_data_by_input_path,
	);
	console.log(
		blue(`[load_source_path_data_by_input_path]`),
		` unmapped_input_paths`,
		unmapped_input_paths,
	);
	return {source_id_path_data_by_input_path, unmapped_input_paths};
};

/**
 * Finds all of the matching files for the given input paths.
 * De-dupes source ids.
 */
export const load_source_ids_by_input_path = async (
	source_id_path_data_by_input_path: Map<Input_Path, Path_Data>,
	custom_search_fs = search_fs,
): Promise<{
	source_ids_by_input_path: Map<Input_Path, Source_Id[]>;
	input_directories_with_no_files: Input_Path[];
}> => {
	console.log(
		`[load_source_ids_by_input_path] source_id_path_data_by_input_path`,
		source_id_path_data_by_input_path,
	);
	const source_ids_by_input_path = new Map<Input_Path, Source_Id[]>();
	const input_directories_with_no_files: Input_Path[] = [];
	const existing_source_ids = new Set<Source_Id>();
	for (const [input_path, path_data] of source_id_path_data_by_input_path) {
		const {id} = path_data;
		if (path_data.isDirectory) {
			const files = await custom_search_fs(id, {files_only: false}); // eslint-disable-line no-await-in-loop
			if (files.size) {
				const source_ids: Source_Id[] = [];
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

// TODO BLOCK I don't think this is valid any more, we shouldn't transform absolute paths like this,
// the searching should happen with the input paths
export const to_gro_input_path = (input_path: Input_Path): Input_Path => {
	const base_path = input_path === paths.lib.slice(0, -1) ? '' : strip_start(input_path, paths.lib);
	return GRO_SVELTEKIT_DIST_DIR + base_path;
};
