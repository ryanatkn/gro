import fs from 'fs-extra';
const {pathExists, stat} = fs; // TODO esm

import {red} from '../colors/terminal.js';
import {fmtPath, fmtError} from '../utils/fmt.js';
import {
	loadSourcePathDataByInputPath,
	loadSourceIdsByInputPath,
} from '../files/inputPaths.js';
import {Timings} from '../utils/time.js';
import {PathStats, PathData} from './pathData.js';
import {toBuildId, isSourceId, groPaths} from '../paths.js';
import {UnreachableError} from '../utils/error.js';

/*

The main functions here, `findModules` and `loadModules`/`loadModule`,
cleanly separate finding from loading.
This has significant performance consequences and is friendly to future changes.
Currently the implementations only use the filesystem,
but eventually we'll have an in-memory virtual filesystem for dev watch mode.

*/

export interface ModuleMeta<ModuleType = Obj> {
	id: string;
	mod: ModuleType;
}

export type LoadModuleResult<T> = {ok: true; mod: T} | LoadModuleFailure;
export type LoadModuleFailure =
	| {ok: false; type: 'importFailed'; id: string; error: Error}
	| {ok: false; type: 'invalid'; id: string; mod: Obj; validation: string};

export const loadModule = async <T>(
	id: string,
	validate?: (mod: Obj) => mod is T,
): Promise<LoadModuleResult<ModuleMeta<T>>> => {
	let mod;
	try {
		// If needed, pass through `groPaths` to allow importing Gro modules.
		mod = await import(
			toBuildId(id, isSourceId(id, groPaths) ? groPaths : undefined)
		);
	} catch (err) {
		return {ok: false, type: 'importFailed', id, error: err};
	}
	if (validate && !validate(mod)) {
		return {ok: false, type: 'invalid', id, mod, validation: validate.name};
	}
	return {ok: true, mod: {id, mod}};
};

export type FindModulesResult = FindModulesSuccess | FindModulesFailure;
export type FindModulesSuccess = {
	ok: true;
	sourceIdsByInputPath: Map<string, string[]>;
	sourceIdPathDataByInputPath: Map<string, PathData>;
	timings: Timings<FindModulesTimings>;
};
export type FindModulesFailure =
	| {
			ok: false;
			type: 'unmappedInputPaths';
			sourceIdPathDataByInputPath: Map<string, PathData>;
			unmappedInputPaths: string[];
			reasons: string[];
	  }
	| {
			ok: false;
			type: 'inputDirectoriesWithNoFiles';
			sourceIdsByInputPath: Map<string, string[]>;
			sourceIdPathDataByInputPath: Map<string, PathData>;
			inputDirectoriesWithNoFiles: string[];
			reasons: string[];
	  };
type FindModulesTimings = 'map input paths' | 'find files';

export type LoadModulesResult<ModuleMetaType> =
	| {
			ok: true;
			modules: ModuleMetaType[];
			findModulesResult: FindModulesSuccess;
			timings: Timings<LoadModulesTimings>;
	  }
	| {
			ok: false;
			type: 'loadModuleFailures';
			loadModuleFailures: LoadModuleFailure[];
			reasons: string[];
			// still return the modules and timings, deferring to the caller
			modules: ModuleMetaType[];
			findModulesResult: FindModulesSuccess;
			timings: Timings<LoadModulesTimings>;
	  };
type LoadModulesTimings = 'load modules';

// This just wraps `findModules` and `loadModules`.
// TODO maybe remove this? it's slightly helpful right now...
export const findAndLoadModules = async <
	ModuleType,
	ModuleMetaType extends ModuleMeta<ModuleType>
>(
	inputPaths: string[],
	findFiles: (id: string) => Promise<Map<string, PathStats>>,
	loadModuleById: (
		sourceId: string,
	) => Promise<LoadModuleResult<ModuleMetaType>>,
	getPossibleSourceIds?: (inputPath: string) => string[],
	timings = new Timings<FindModulesTimings | LoadModulesTimings>(),
): Promise<LoadModulesResult<ModuleMetaType> | FindModulesFailure> => {
	const findModulesResult = await findModules(
		inputPaths,
		findFiles,
		getPossibleSourceIds,
		timings as Timings<FindModulesTimings>, // is typesafe, but what's a better way?
	);
	if (!findModulesResult.ok) return findModulesResult;

	// We now have a list of files! Load each file's module.
	return loadModules(
		findModulesResult,
		loadModuleById,
		timings as Timings<LoadModulesTimings>, // is typesafe, but what's a better way?
	);
};

/*

Loads modules from input paths. (see `src/files/inputPaths.ts` for more)

*/
export const findModules = async (
	inputPaths: string[],
	findFiles: (id: string) => Promise<Map<string, PathStats>>,
	getPossibleSourceIds?: (inputPath: string) => string[],
	timings = new Timings<FindModulesTimings>(),
): Promise<FindModulesResult> => {
	// Check which extension variation works - if it's a directory, prefer others first!
	timings.start('map input paths');
	const {
		sourceIdPathDataByInputPath,
		unmappedInputPaths,
	} = await loadSourcePathDataByInputPath(
		inputPaths,
		pathExists,
		stat,
		getPossibleSourceIds,
	);
	timings.stop('map input paths');

	// Error if any input path could not be mapped.
	if (unmappedInputPaths.length) {
		return {
			ok: false,
			type: 'unmappedInputPaths',
			sourceIdPathDataByInputPath,
			unmappedInputPaths,
			reasons: unmappedInputPaths.map(inputPath =>
				red(
					`Input path ${fmtPath(
						inputPath,
					)} cannot be mapped to a file or directory.`,
				),
			),
		};
	}

	// Find all of the files for any directories.
	timings.start('find files');
	const {
		sourceIdsByInputPath,
		inputDirectoriesWithNoFiles,
	} = await loadSourceIdsByInputPath(sourceIdPathDataByInputPath, id =>
		findFiles(id),
	);
	timings.stop('find files');

	// Error if any input path has no files. (means we have an empty directory)
	return inputDirectoriesWithNoFiles.length
		? {
				ok: false,
				type: 'inputDirectoriesWithNoFiles',
				sourceIdPathDataByInputPath,
				sourceIdsByInputPath,
				inputDirectoriesWithNoFiles,
				reasons: inputDirectoriesWithNoFiles.map(inputPath =>
					red(
						`Input directory ${fmtPath(inputPath)} contains no matching files.`,
					),
				),
		  }
		: {ok: true, sourceIdsByInputPath, sourceIdPathDataByInputPath, timings};
};

export const loadModules = async <
	ModuleType,
	ModuleMetaType extends ModuleMeta<ModuleType>
>(
	findModulesResult: FindModulesSuccess,
	loadModuleById: (
		sourceId: string,
	) => Promise<LoadModuleResult<ModuleMetaType>>,
	timings = new Timings<LoadModulesTimings>(),
): Promise<LoadModulesResult<ModuleMetaType>> => {
	// This is done serially because importing test files requires
	// linking the current file with the module's initial execution.
	// TODO parallelize!
	timings.start('load modules');
	const modules: ModuleMetaType[] = [];
	const loadModuleFailures: LoadModuleFailure[] = [];
	const reasons: string[] = [];
	for (const [inputPath, sourceIds] of findModulesResult.sourceIdsByInputPath) {
		for (const id of sourceIds) {
			const result = await loadModuleById(id);
			if (result.ok) {
				modules.push(result.mod);
			} else {
				loadModuleFailures.push(result);
				switch (result.type) {
					case 'importFailed': {
						reasons.push(
							red(
								`Module import ${fmtPath(id)} failed from input ${fmtPath(
									inputPath,
								)}: ${fmtError(result.error)}`,
							),
						);
						break;
					}
					case 'invalid': {
						reasons.push(
							red(
								`Module ${fmtPath(id)} failed validation '${
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
	timings.stop('load modules');

	return loadModuleFailures.length
		? {
				ok: false,
				type: 'loadModuleFailures',
				loadModuleFailures,
				reasons,
				modules,
				findModulesResult,
				timings,
		  }
		: {ok: true, modules, findModulesResult, timings};
};
