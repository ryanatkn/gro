import {red} from 'kleur/colors';
import {Timings} from '@feltjs/util/timings.js';
import {UnreachableError} from '@feltjs/util/error.js';
import type {Result} from '@feltjs/util/result.js';
import {printError} from '@feltjs/util/print.js';

import {loadSourcePathDataByInputPath, loadSourceIdsByInputPath} from '../path/inputPath.js';
import type {PathStats, PathData} from '../path/path_data.js';
import {paths_from_id, print_path, print_path_or_gro_path, type SourceId} from '../path/paths.js';
import type {Filesystem} from './filesystem.js';

/*

The main functions here, `find_modules` and `load_modules`/`load_module`,
cleanly separate finding from loading.
This has significant performance consequences and is friendly to future changes.
Currently the implementations only use the filesystem,
but eventually we'll have an in-memory virtual filesystem for dev watch mode.

TODO now that `Filer` is here, integrate it further

*/

export interface ModuleMeta<TModule extends Record<string, any> = Record<string, any>> {
	id: string;
	mod: TModule;
}

export type LoadModuleResult<T> = Result<{mod: T}, LoadModuleFailure>;
export type LoadModuleFailure =
	| {ok: false; type: 'importFailed'; id: string; error: Error}
	| {ok: false; type: 'invalid'; id: string; mod: Record<string, any>; validation: string};

export const load_module = async <T extends Record<string, any>>(
	id: string,
	validate?: (mod: Record<string, any>) => mod is T,
): Promise<LoadModuleResult<ModuleMeta<T>>> => {
	console.log(`load_module`, id);
	let mod;
	try {
		mod = await import(id); // TODO BLOCK is this right?
	} catch (err) {
		return {ok: false, type: 'importFailed', id, error: err};
	}
	if (validate && !validate(mod)) {
		return {ok: false, type: 'invalid', id, mod, validation: validate.name};
	}
	return {ok: true, mod: {id, mod}};
};

export type FindModulesResult = Result<
	{
		source_ids_by_input_path: Map<string, string[]>;
		source_idPathDataByInputPath: Map<string, PathData>;
		timings: Timings<FindModulesTimings>;
	},
	FindModulesFailure
>;
export type FindModulesFailure =
	| {
			type: 'unmappedInputPaths';
			source_idPathDataByInputPath: Map<string, PathData>;
			unmappedInputPaths: string[];
			reasons: string[];
	  }
	| {
			type: 'inputDirectoriesWithNoFiles';
			source_ids_by_input_path: Map<string, string[]>;
			source_idPathDataByInputPath: Map<string, PathData>;
			inputDirectoriesWithNoFiles: string[];
			reasons: string[];
	  };
type FindModulesTimings = 'map input paths' | 'find files';

export type LoadModulesResult<TModuleMeta extends ModuleMeta> = Result<
	{
		modules: TModuleMeta[];
		timings: Timings<LoadModulesTimings>;
	},
	{
		type: 'load_moduleFailures';
		load_moduleFailures: LoadModuleFailure[];
		reasons: string[];
		// still return the modules and timings, deferring to the caller
		modules: TModuleMeta[];
		timings: Timings<LoadModulesTimings>;
	}
>;
type LoadModulesTimings = 'load modules';

/*

Finds modules from input paths. (see `src/lib/path/inputPath.ts` for more)

*/
export const find_modules = async (
	fs: Filesystem,
	input_paths: string[],
	findFiles: (id: string) => Promise<Map<string, PathStats>>,
	get_possible_source_ids?: (inputPath: string) => string[],
): Promise<FindModulesResult> => {
	// Check which extension variation works - if it's a directory, prefer others first!
	const timings = new Timings<FindModulesTimings>();
	const timingToMapInputPaths = timings.start('map input paths');
	const {source_idPathDataByInputPath, unmappedInputPaths} = await loadSourcePathDataByInputPath(
		fs,
		input_paths,
		get_possible_source_ids,
	);
	timingToMapInputPaths();

	// Error if any input path could not be mapped.
	if (unmappedInputPaths.length) {
		return {
			ok: false,
			type: 'unmappedInputPaths',
			source_idPathDataByInputPath,
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
	const {source_ids_by_input_path, inputDirectoriesWithNoFiles} = await loadSourceIdsByInputPath(
		source_idPathDataByInputPath,
		(id) => findFiles(id),
	);
	timingToFindFiles();

	// Error if any input path has no files. (means we have an empty directory)
	return inputDirectoriesWithNoFiles.length
		? {
				ok: false,
				type: 'inputDirectoriesWithNoFiles',
				source_idPathDataByInputPath,
				source_ids_by_input_path,
				inputDirectoriesWithNoFiles,
				reasons: inputDirectoriesWithNoFiles.map((inputPath) =>
					red(
						`Input directory ${print_path_or_gro_path(
							source_idPathDataByInputPath.get(inputPath)!.id,
							paths_from_id(inputPath),
						)} contains no matching files.`,
					),
				),
		  }
		: {ok: true, source_ids_by_input_path, source_idPathDataByInputPath, timings};
};

/*

Load modules by source id.

TODO parallelize, originally it needed to be serial for a specific usecase we no longer have

*/
export const load_modules = async <
	ModuleType extends Record<string, any>,
	TModuleMeta extends ModuleMeta<ModuleType>,
>(
	source_ids_by_input_path: Map<string, string[]>, // TODO maybe make this a flat array and remove `inputPath`?
	dev: boolean,
	load_moduleById: (source_id: SourceId, dev: boolean) => Promise<LoadModuleResult<TModuleMeta>>,
): Promise<LoadModulesResult<TModuleMeta>> => {
	const timings = new Timings<LoadModulesTimings>();
	const timingToLoadModules = timings.start('load modules');
	const modules: TModuleMeta[] = [];
	const load_moduleFailures: LoadModuleFailure[] = [];
	const reasons: string[] = [];
	for (const [inputPath, source_ids] of source_ids_by_input_path) {
		for (const id of source_ids) {
			const result = await load_moduleById(id, dev); // eslint-disable-line no-await-in-loop
			if (result.ok) {
				modules.push(result.mod);
			} else {
				load_moduleFailures.push(result);
				switch (result.type) {
					case 'importFailed': {
						reasons.push(
							`Module import ${print_path(id, paths_from_id(id))} failed from input ${print_path(
								inputPath,
								paths_from_id(inputPath),
							)}: ${printError(result.error)}`,
						);
						break;
					}
					case 'invalid': {
						// TODO BLOCK try to make this a good error message for the task case
						reasons.push(
							`Module ${print_path(id, paths_from_id(id))} failed validation '${
								result.validation
							}'.`,
						);
						break;
					}
					default:
						throw new UnreachableError(result);
				}
			}
		}
	}
	timingToLoadModules();

	return load_moduleFailures.length
		? {
				ok: false,
				type: 'load_moduleFailures',
				load_moduleFailures,
				reasons,
				modules,
				timings,
		  }
		: {ok: true, modules, timings};
};
