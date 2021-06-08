import {red} from '@feltcoop/felt/utils/terminal.js';
import {Timings} from '@feltcoop/felt/utils/time.js';
import {Unreachable_Error} from '@feltcoop/felt/utils/error.js';
import type {Result} from '@feltcoop/felt/utils/types.js';
import {print_error} from '@feltcoop/felt/utils/print.js';

import {
	load_source_path_data_by_input_path,
	load_source_ids_by_input_path,
} from '../fs/inputPath.js';
import type {Path_Stats, Path_Data} from './path_data.js';
import {to_import_id, paths_from_id, print_path, print_path_or_gro_path} from '../paths.js';
import {SYSTEM_BUILD_NAME} from '../build/default_build_config.js';
import type {Filesystem} from './filesystem.js';

/*

The main functions here, `findModules` and `load_modules`/`loadModule`,
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

export const loadModule = async <T>(
	id: string,
	validate?: (mod: Record<string, any>) => mod is T,
	dev = process.env.NODE_ENV !== 'production',
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
		timings: Timings<FindModulesTimings>;
	},
	| {
			type: 'unmappedInputPaths';
			source_id_path_data_by_input_path: Map<string, Path_Data>;
			unmappedInputPaths: string[];
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
type FindModulesTimings = 'map input paths' | 'find files';

export type LoadModulesResult<Module_MetaType extends Module_Meta> = Result<
	{
		modules: Module_MetaType[];
		timings: Timings<LoadModulesTimings>;
	},
	{
		type: 'loadModuleFailures';
		loadModuleFailures: Load_Module_Failure[];
		reasons: string[];
		// still return the modules and timings, deferring to the caller
		modules: Module_MetaType[];
		timings: Timings<LoadModulesTimings>;
	}
>;
type LoadModulesTimings = 'load modules';

/*

Finds modules from input paths. (see `src/fs/inputPath.ts` for more)

*/
export const findModules = async (
	fs: Filesystem,
	inputPaths: string[],
	findFiles: (id: string) => Promise<Map<string, Path_Stats>>,
	getPossibleSourceIds?: (inputPath: string) => string[],
): Promise<Find_Modules_Result> => {
	// Check which extension variation works - if it's a directory, prefer others first!
	const timings = new Timings<FindModulesTimings>();
	const timingToMapInputPaths = timings.start('map input paths');
	const {
		source_id_path_data_by_input_path,
		unmappedInputPaths,
	} = await load_source_path_data_by_input_path(fs, inputPaths, getPossibleSourceIds);
	timingToMapInputPaths();

	// Error if any input path could not be mapped.
	if (unmappedInputPaths.length) {
		return {
			ok: false,
			type: 'unmappedInputPaths',
			source_id_path_data_by_input_path,
			unmappedInputPaths,
			reasons: unmappedInputPaths.map((inputPath) =>
				red(
					`Input path ${print_path_or_gro_path(
						inputPath,
						paths_from_id(inputPath),
					)} cannot be mapped to a file or directory.`,
				),
			),
		};
	}

	// Find all of the files for any directories.
	const timingToFindFiles = timings.start('find files');
	const {
		source_ids_by_input_path,
		input_directories_with_no_files,
	} = await load_source_ids_by_input_path(source_id_path_data_by_input_path, (id) => findFiles(id));
	timingToFindFiles();

	// Error if any input path has no files. (means we have an empty directory)
	return input_directories_with_no_files.length
		? {
				ok: false,
				type: 'input_directories_with_no_files',
				source_id_path_data_by_input_path,
				source_ids_by_input_path,
				input_directories_with_no_files,
				reasons: input_directories_with_no_files.map((inputPath) =>
					red(
						`Input directory ${print_path_or_gro_path(
							source_id_path_data_by_input_path.get(inputPath)!.id,
							paths_from_id(inputPath),
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
TODO parallelize..how? Separate functions? `load_modulesSerially`?

*/
export const load_modules = async <Module_Type, Module_MetaType extends Module_Meta<Module_Type>>(
	source_ids_by_input_path: Map<string, string[]>, // TODO maybe make this a flat array and remove `inputPath`?
	loadModuleById: (source_id: string) => Promise<Load_Module_Result<Module_MetaType>>,
): Promise<LoadModulesResult<Module_MetaType>> => {
	const timings = new Timings<LoadModulesTimings>();
	const timingToLoadModules = timings.start('load modules');
	const modules: Module_MetaType[] = [];
	const loadModuleFailures: Load_Module_Failure[] = [];
	const reasons: string[] = [];
	for (const [inputPath, source_ids] of source_ids_by_input_path) {
		for (const id of source_ids) {
			const result = await loadModuleById(id);
			if (result.ok) {
				modules.push(result.mod);
			} else {
				loadModuleFailures.push(result);
				switch (result.type) {
					case 'import_failed': {
						reasons.push(
							red(
								`Module import ${print_path(id, paths_from_id(id))} failed from input ${print_path(
									inputPath,
									paths_from_id(inputPath),
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
	timingToLoadModules();

	return loadModuleFailures.length
		? {
				ok: false,
				type: 'loadModuleFailures',
				loadModuleFailures,
				reasons,
				modules,
				timings,
		  }
		: {ok: true, modules, timings};
};
