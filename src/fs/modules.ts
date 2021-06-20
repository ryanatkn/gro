import {red} from '@feltcoop/felt/util/terminal.js';
import {Timings} from '@feltcoop/felt/util/time.js';
import {Unreachable_Error} from '@feltcoop/felt/util/error.js';
import type {Result} from '@feltcoop/felt/util/types.js';
import {print_error} from '@feltcoop/felt/util/print.js';

import {
	load_source_path_data_by_input_path,
	load_source_ids_by_input_path,
} from '../fs/input_path.js';
import type {Path_Stats, Path_Data} from './path_data.js';
import {to_import_id, paths_from_id, print_path, print_path_or_gro_path} from '../paths.js';
import {SYSTEM_BUILD_NAME} from '../build/default_build_config.js';
import type {Filesystem} from './filesystem.js';

/*

The main functions here, `find_modules` and `load_modules`/`load_module`,
cleanly separate finding from loading.
This has significant performance consequences and is friendly to future changes.
Currently the implementations only use the filesystem,
but eventually we'll have an in-memory virtual filesystem for dev watch mode.

TODO now that `Filer` is here, integrate it further

*/

export interface Module_Meta<Module_Type = Record<string, any>> {
	id: string;
	mod: Module_Type;
}

export type Load_Module_Result<T> = Result<{mod: T}, Load_Module_Failure>;
export type Load_Module_Failure =
	| {ok: false; type: 'import_failed'; id: string; error: Error}
	| {ok: false; type: 'invalid'; id: string; mod: Record<string, any>; validation: string};

export const load_module = async <T>(
	id: string,
	dev: boolean,
	validate?: (mod: Record<string, any>) => mod is T,
	build_name = SYSTEM_BUILD_NAME,
): Promise<Load_Module_Result<Module_Meta<T>>> => {
	let mod;
	try {
		mod = await import(to_import_id(id, dev, build_name));
	} catch (err) {
		return {ok: false, type: 'import_failed', id, error: err};
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
		timings: Timings<Find_Modules_Timings>;
	},
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
	  }
>;
type Find_Modules_Timings = 'map input paths' | 'find files';

export type Load_Modules_Result<Module_Meta_Type extends Module_Meta> = Result<
	{
		modules: Module_Meta_Type[];
		timings: Timings<Load_Modules_Timings>;
	},
	{
		type: 'load_module_failures';
		load_module_failures: Load_Module_Failure[];
		reasons: string[];
		// still return the modules and timings, deferring to the caller
		modules: Module_Meta_Type[];
		timings: Timings<Load_Modules_Timings>;
	}
>;
type Load_Modules_Timings = 'load modules';

/*

Finds modules from input paths. (see `src/fs/input_path.ts` for more)

*/
export const find_modules = async (
	fs: Filesystem,
	input_paths: string[],
	find_files: (id: string) => Promise<Map<string, Path_Stats>>,
	get_possible_source_ids?: (input_path: string) => string[],
): Promise<Find_Modules_Result> => {
	// Check which extension variation works - if it's a directory, prefer others first!
	const timings = new Timings<Find_Modules_Timings>();
	const timing_to_map_input_paths = timings.start('map input paths');
	const {
		source_id_path_data_by_input_path,
		unmapped_input_paths,
	} = await load_source_path_data_by_input_path(fs, input_paths, get_possible_source_ids);
	timing_to_map_input_paths();

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
	const timing_to_find_files = timings.start('find files');
	const {
		source_ids_by_input_path,
		input_directories_with_no_files,
	} = await load_source_ids_by_input_path(source_id_path_data_by_input_path, (id) =>
		find_files(id),
	);
	timing_to_find_files();

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
		: {ok: true, source_ids_by_input_path, source_id_path_data_by_input_path, timings};
};

/*

Load modules by source id.
This runs serially because importing test files requires
linking the current file with the module's initial execution.
TODO parallelize..how? Separate functions? `load_modules_serially`?

*/
export const load_modules = async <Module_Type, Module_Meta_Type extends Module_Meta<Module_Type>>(
	source_ids_by_input_path: Map<string, string[]>, // TODO maybe make this a flat array and remove `input_path`?
	dev: boolean,
	load_module_by_id: (
		source_id: string,
		dev: boolean,
	) => Promise<Load_Module_Result<Module_Meta_Type>>,
): Promise<Load_Modules_Result<Module_Meta_Type>> => {
	const timings = new Timings<Load_Modules_Timings>();
	const timing_to_load_modules = timings.start('load modules');
	const modules: Module_Meta_Type[] = [];
	const load_module_failures: Load_Module_Failure[] = [];
	const reasons: string[] = [];
	for (const [input_path, source_ids] of source_ids_by_input_path) {
		for (const id of source_ids) {
			const result = await load_module_by_id(id, dev);
			if (result.ok) {
				modules.push(result.mod);
			} else {
				load_module_failures.push(result);
				switch (result.type) {
					case 'import_failed': {
						reasons.push(
							red(
								`Module import ${print_path(id, paths_from_id(id))} failed from input ${print_path(
									input_path,
									paths_from_id(input_path),
								)}: ${print_error(result.error)}`,
							),
						);
						break;
					}
					case 'invalid': {
						reasons.push(
							red(
								`Module ${print_path(id, paths_from_id(id))} failed validation '${
									result.validation
								}'.`,
							),
						);
						break;
					}
					default:
						throw new Unreachable_Error(result);
				}
			}
		}
	}
	timing_to_load_modules();

	return load_module_failures.length
		? {
				ok: false,
				type: 'load_module_failures',
				load_module_failures,
				reasons,
				modules,
				timings,
		  }
		: {ok: true, modules, timings};
};
