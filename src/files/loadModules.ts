import fs from 'fs-extra';
const {pathExists, stat} = fs; // TODO esm

import {red} from '../colors/terminal.js';
import {fmtPath} from '../utils/fmt.js';
import {
	loadSourcePathDataByInputPath,
	loadSourceIdsByInputPath,
} from '../files/inputPaths.js';
import {Timings} from '../utils/time.js';
import {PathStats} from './pathData.js';
import {toBuildId} from '../paths.js';
import {UnreachableError} from '../utils/error.js';

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
		mod = await import(toBuildId(id));
	} catch (err) {
		return {ok: false, type: 'importFailed', id, error: err};
	}
	if (validate && !validate(mod)) {
		return {ok: false, type: 'invalid', id, mod, validation: validate.name};
	}
	return {ok: true, mod: {id, mod}};
};

export type LoadModulesResult<ModuleMetaType> =
	| {
			ok: true;
			modules: ModuleMetaType[];
			timings: Timings<LoadModuleTimings>;
	  }
	| {
			ok: false;
			type: 'unmappedInputPaths';
			unmappedInputPaths: string[];
			reasons: string[];
	  }
	| {
			ok: false;
			type: 'inputDirectoriesWithNoFiles';
			inputDirectoriesWithNoFiles: string[];
			reasons: string[];
	  }
	| {
			ok: false;
			type: 'loadModuleFailures';
			loadModuleFailures: LoadModuleFailure[];
			reasons: string[];
			// still return the modules and timings, deferring to the caller
			modules: ModuleMetaType[];
			timings: Timings<LoadModuleTimings>;
	  };

type LoadModuleTimings = 'map input paths' | 'find files' | 'load modules';

/*

Loads modules from input paths. (see `src/files/inputPaths.ts` for more)

TODO make this compatible with a virtual fs when we add watch mode

*/
export const loadModules = async <
	ModuleType,
	ModuleMetaType extends ModuleMeta<ModuleType>
>(
	inputPaths: string[],
	extensions: string[],
	findFiles: (id: string) => Promise<Map<string, PathStats>>,
	loadModuleById: (
		sourceId: string,
	) => Promise<LoadModuleResult<ModuleMetaType>>,
): Promise<LoadModulesResult<ModuleMetaType>> => {
	const timings = new Timings<LoadModuleTimings>();

	// Resolve input paths.
	timings.start('map input paths');

	// Check which extension variation works - if it's a directory, prefer others first!
	const {
		sourceIdPathDataByInputPath,
		unmappedInputPaths,
	} = await loadSourcePathDataByInputPath(
		inputPaths,
		extensions,
		pathExists,
		stat,
	);
	timings.stop('map input paths');

	// Error if any input path could not be mapped.
	if (unmappedInputPaths.length) {
		return {
			ok: false,
			type: 'unmappedInputPaths',
			unmappedInputPaths,
			reasons: unmappedInputPaths.map(inputPath =>
				red(
					`Input path cannot be mapped to a file or directory: ${fmtPath(
						inputPath,
					)}`,
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
	if (inputDirectoriesWithNoFiles.length) {
		return {
			ok: false,
			type: 'inputDirectoriesWithNoFiles',
			inputDirectoriesWithNoFiles,
			reasons: inputDirectoriesWithNoFiles.map(inputPath =>
				red(
					`Input directory contains no matching files: ${fmtPath(inputPath)}`,
				),
			),
		};
	}

	// We now have a list of files! Load each file's module.
	// This is done serially because importing test files requires
	// linking the current file with the module's initial execution.
	timings.start('load modules');
	const modules: ModuleMetaType[] = [];
	const loadModuleFailures: LoadModuleFailure[] = [];
	const reasons: string[] = [];
	for (const [inputPath, sourceIds] of sourceIdsByInputPath) {
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
								`Module import failed: ${fmtPath(id)} from input ${fmtPath(
									inputPath,
								)}`,
							),
						);
						break;
					}
					case 'invalid': {
						reasons.push(
							red(
								`Module failed validation '${result.validation}': ${fmtPath(
									id,
								)}`,
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

	if (loadModuleFailures.length) {
		return {
			ok: false,
			type: 'loadModuleFailures',
			loadModuleFailures,
			reasons,
			modules,
			timings,
		};
	}

	return {ok: true, modules, timings};
};
