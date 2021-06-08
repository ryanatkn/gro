import {red} from '@feltcoop/felt/utils/terminal.js';
import {Timings} from '@feltcoop/felt/utils/time.js';
import {UnreachableError} from '@feltcoop/felt/utils/error.js';
import type {Result} from '@feltcoop/felt/utils/types.js';
import {printError} from '@feltcoop/felt/utils/print.js';

import {loadSourcePathDataByInputPath, loadSourceIdsByInputPath} from '../fs/inputPath.js';
import type {PathStats, PathData} from './pathData.js';
import {to_import_id, paths_from_id, print_path, print_path_or_gro_path} from '../paths.js';
import {SYSTEM_BUILD_NAME} from '../build/default_build_config.js';
import type {Filesystem} from './filesystem.js';

/*

The main functions here, `findModules` and `loadModules`/`loadModule`,
cleanly separate finding from loading.
This has significant performance consequences and is friendly to future changes.
Currently the implementations only use the filesystem,
but eventually we'll have an in-memory virtual filesystem for dev watch mode.

TODO now that `Filer` is here, integrate it further

*/

export interface ModuleMeta<ModuleType = Record<string, any>> {
	id: string;
	mod: ModuleType;
}

export type LoadModuleResult<T> = Result<{mod: T}, LoadModuleFailure>;
export type LoadModuleFailure =
	| {ok: false; type: 'importFailed'; id: string; error: Error}
	| {ok: false; type: 'invalid'; id: string; mod: Record<string, any>; validation: string};

export const loadModule = async <T>(
	id: string,
	validate?: (mod: Record<string, any>) => mod is T,
	dev = process.env.NODE_ENV !== 'production',
	build_name = SYSTEM_BUILD_NAME,
): Promise<LoadModuleResult<ModuleMeta<T>>> => {
	let mod;
	try {
		mod = await import(to_import_id(id, dev, build_name));
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
		source_idsByInputPath: Map<string, string[]>;
		source_idPathDataByInputPath: Map<string, PathData>;
		timings: Timings<FindModulesTimings>;
	},
	| {
			type: 'unmappedInputPaths';
			source_idPathDataByInputPath: Map<string, PathData>;
			unmappedInputPaths: string[];
			reasons: string[];
	  }
	| {
			type: 'inputDirectoriesWithNoFiles';
			source_idsByInputPath: Map<string, string[]>;
			source_idPathDataByInputPath: Map<string, PathData>;
			inputDirectoriesWithNoFiles: string[];
			reasons: string[];
	  }
>;
type FindModulesTimings = 'map input paths' | 'find files';

export type LoadModulesResult<ModuleMetaType extends ModuleMeta> = Result<
	{
		modules: ModuleMetaType[];
		timings: Timings<LoadModulesTimings>;
	},
	{
		type: 'loadModuleFailures';
		loadModuleFailures: LoadModuleFailure[];
		reasons: string[];
		// still return the modules and timings, deferring to the caller
		modules: ModuleMetaType[];
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
	findFiles: (id: string) => Promise<Map<string, PathStats>>,
	getPossibleSourceIds?: (inputPath: string) => string[],
): Promise<FindModulesResult> => {
	// Check which extension variation works - if it's a directory, prefer others first!
	const timings = new Timings<FindModulesTimings>();
	const timingToMapInputPaths = timings.start('map input paths');
	const {source_idPathDataByInputPath, unmappedInputPaths} = await loadSourcePathDataByInputPath(
		fs,
		inputPaths,
		getPossibleSourceIds,
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
	const {
		source_idsByInputPath,
		inputDirectoriesWithNoFiles,
	} = await loadSourceIdsByInputPath(source_idPathDataByInputPath, (id) => findFiles(id));
	timingToFindFiles();

	// Error if any input path has no files. (means we have an empty directory)
	return inputDirectoriesWithNoFiles.length
		? {
				ok: false,
				type: 'inputDirectoriesWithNoFiles',
				source_idPathDataByInputPath,
				source_idsByInputPath,
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
		: {ok: true, source_idsByInputPath, source_idPathDataByInputPath, timings};
};

/*

Load modules by source id.
This runs serially because importing test files requires
linking the current file with the module's initial execution.
TODO parallelize..how? Separate functions? `loadModulesSerially`?

*/
export const loadModules = async <ModuleType, ModuleMetaType extends ModuleMeta<ModuleType>>(
	source_idsByInputPath: Map<string, string[]>, // TODO maybe make this a flat array and remove `inputPath`?
	loadModuleById: (source_id: string) => Promise<LoadModuleResult<ModuleMetaType>>,
): Promise<LoadModulesResult<ModuleMetaType>> => {
	const timings = new Timings<LoadModulesTimings>();
	const timingToLoadModules = timings.start('load modules');
	const modules: ModuleMetaType[] = [];
	const loadModuleFailures: LoadModuleFailure[] = [];
	const reasons: string[] = [];
	for (const [inputPath, source_ids] of source_idsByInputPath) {
		for (const id of source_ids) {
			const result = await loadModuleById(id);
			if (result.ok) {
				modules.push(result.mod);
			} else {
				loadModuleFailures.push(result);
				switch (result.type) {
					case 'importFailed': {
						reasons.push(
							red(
								`Module import ${print_path(id, paths_from_id(id))} failed from input ${print_path(
									inputPath,
									paths_from_id(inputPath),
								)}: ${printError(result.error)}`,
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
						throw new UnreachableError(result);
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
