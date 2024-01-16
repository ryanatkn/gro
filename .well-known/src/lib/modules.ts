import {red} from 'kleur/colors';
import type {Timings} from '@ryanatkn/util/timings.js';
import {Unreachable_Error} from '@ryanatkn/util/error.js';
import type {Result} from '@ryanatkn/util/result.js';
import {print_error} from '@ryanatkn/util/print.js';

import {load_source_path_data_by_input_path, load_source_ids_by_input_path} from './input_path.js';
import type {Path_Data} from './path.js';
import {paths_from_id, print_path, print_path_or_gro_path, type Source_Id} from './paths.js';
import {search_fs} from './search_fs.js';

export interface Module_Meta<T_Module extends Record<string, any> = Record<string, any>> {
	id: string;
	mod: T_Module;
}

export type Load_Module_Result<T> = Result<{mod: T}, Load_Module_Failure>;
export type Load_Module_Failure =
	| {ok: false; type: 'importFailed'; id: string; error: Error}
	| {ok: false; type: 'invalid'; id: string; mod: Record<string, any>; validation: string};

export const load_module = async <T extends Record<string, any>>(
	id: string,
	validate?: (mod: Record<string, any>) => mod is T,
): Promise<Load_Module_Result<Module_Meta<T>>> => {
	let mod;
	try {
		mod = await import(id);
	} catch (err) {
		return {ok: false, type: 'importFailed', id, error: err};
	}
	if (validate && !validate(mod)) {
		return {ok: false, type: 'invalid', id, mod, validation: validate.name};
	}
	return {ok: true, mod: {id, mod}};
};

export type Find_Modules_Result = Result<
	{
		source_ids_by_input_path: Map<string, string[]>;
		source_id_path_data_by_input_path: Map<string, Path_Data>;
	},
	Find_Modules_Failure
>;
export type Find_Modules_Failure =
	| {
			type: 'unmapped_input_paths';
			source_id_path_data_by_input_path: Map<string, Path_Data>;
			unmapped_input_paths: string[];
			reasons: string[];
	  }
	| {
			type: 'input_directories_with_no_files';
			source_ids_by_input_path: Map<string, string[]>;
			source_id_path_data_by_input_path: Map<string, Path_Data>;
			input_directories_with_no_files: string[];
			reasons: string[];
	  };

export type Load_Modules_Result<T_Module_Meta extends Module_Meta> = Result<
	{
		modules: T_Module_Meta[];
	},
	{
		type: 'load_module_failures';
		load_module_failures: Load_Module_Failure[];
		reasons: string[];
		// still return the modules and timings, deferring to the caller
		modules: T_Module_Meta[];
	}
>;

/*

Finds modules from input paths. (see `src/lib/input_path.ts` for more)

*/
export const find_modules = async (
	input_paths: string[],
	custom_search_fs = search_fs,
	get_possible_source_ids?: (input_path: string) => string[],
	timings?: Timings,
): Promise<Find_Modules_Result> => {
	// Check which extension variation works - if it's a directory, prefer others first!
	const timing_to_map_input_paths = timings?.start('map input paths');
	const {source_id_path_data_by_input_path, unmapped_input_paths} =
		await load_source_path_data_by_input_path(input_paths, get_possible_source_ids);
	timing_to_map_input_paths?.();

	// Error if any input path could not be mapped.
	if (unmapped_input_paths.length) {
		return {
			ok: false,
			type: 'unmapped_input_paths',
			source_id_path_data_by_input_path,
			unmapped_input_paths,
			reasons: unmapped_input_paths.map((input_path) =>
				red(
					`Input path ${print_path_or_gro_path(
						input_path,
						paths_from_id(input_path),
					)} cannot be mapped to a file or directory.`,
				),
			),
		};
	}

	// Find all of the files for any directories.
	const timing_to_search_fs = timings?.start('find files');
	const {source_ids_by_input_path, input_directories_with_no_files} =
		await load_source_ids_by_input_path(source_id_path_data_by_input_path, custom_search_fs);
	timing_to_search_fs?.();

	// Error if any input path has no files. (means we have an empty directory)
	return input_directories_with_no_files.length
		? {
				ok: false,
				type: 'input_directories_with_no_files',
				source_id_path_data_by_input_path,
				source_ids_by_input_path,
				input_directories_with_no_files,
				reasons: input_directories_with_no_files.map((input_path) =>
					red(
						`Input directory ${print_path_or_gro_path(
							source_id_path_data_by_input_path.get(input_path)!.id,
							paths_from_id(input_path),
						)} contains no matching files.`,
					),
				),
			}
		: {ok: true, source_ids_by_input_path, source_id_path_data_by_input_path};
};

/*

Load modules by source id.

TODO parallelize, originally it needed to be serial for a specific usecase we no longer have

*/
export const load_modules = async <
	Module_Type extends Record<string, any>,
	T_Module_Meta extends Module_Meta<Module_Type>,
>(
	source_ids_by_input_path: Map<string, string[]>, // TODO maybe make this a flat array and remove `input_path`?
	load_module_by_id: (source_id: Source_Id) => Promise<Load_Module_Result<T_Module_Meta>>,
	timings?: Timings,
): Promise<Load_Modules_Result<T_Module_Meta>> => {
	const timing_to_load_modules = timings?.start('load modules');
	const modules: T_Module_Meta[] = [];
	const load_module_failures: Load_Module_Failure[] = [];
	const reasons: string[] = [];
	for (const [input_path, source_ids] of source_ids_by_input_path) {
		for (const id of source_ids) {
			const result = await load_module_by_id(id); // eslint-disable-line no-await-in-loop
			if (result.ok) {
				modules.push(result.mod);
			} else {
				load_module_failures.push(result);
				switch (result.type) {
					case 'importFailed': {
						reasons.push(
							`Module import ${print_path(id, paths_from_id(id))} failed from input ${print_path(
								input_path,
								paths_from_id(input_path),
							)}: ${print_error(result.error)}`,
						);
						break;
					}
					case 'invalid': {
						// TODO try to make this a good error message for the task case
						reasons.push(
							`Module ${print_path(id, paths_from_id(id))} failed validation '${
								result.validation
							}'.`,
						);
						break;
					}
					default:
						throw new Unreachable_Error(result);
				}
			}
		}
	}
	timing_to_load_modules?.();

	return load_module_failures.length
		? {
				ok: false,
				type: 'load_module_failures',
				load_module_failures,
				reasons,
				modules,
			}
		: {ok: true, modules};
};
