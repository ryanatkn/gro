import {ModuleMeta, loadModule, LoadModuleResult, findModules} from '../fs/modules.js';
import {Gen, GenResults, GenFile, isGenPath, GEN_FILE_PATTERN} from './gen.js';
import {pathExists, readFile, findFiles} from '../fs/nodeFs.js';
import {getPossibleSourceIds} from '../fs/inputPath.js';
import {paths} from '../paths.js';
import type {Obj} from '../types.js';

export interface GenModule {
	gen: Gen;
}

export interface GenModuleMeta extends ModuleMeta<GenModule> {}

export const validateGenModule = (mod: Obj): mod is GenModule => typeof mod.gen === 'function';

export const loadGenModule = (id: string): Promise<LoadModuleResult<GenModuleMeta>> =>
	loadModule(id, validateGenModule);

export type CheckGenModuleResult =
	| {
			file: GenFile;
			existingContents: string;
			isNew: false;
			hasChanged: boolean;
	  }
	| {
			file: GenFile;
			existingContents: null;
			isNew: true;
			hasChanged: true;
	  };

export const checkGenModules = async (genResults: GenResults): Promise<CheckGenModuleResult[]> => {
	return Promise.all(
		genResults.successes.map((result) => result.files.map((file) => checkGenModule(file))).flat(),
	);
};

export const checkGenModule = async (file: GenFile): Promise<CheckGenModuleResult> => {
	if (!(await pathExists(file.id))) {
		return {
			file,
			existingContents: null,
			isNew: true,
			hasChanged: true,
		};
	}
	const existingContents = await readFile(file.id, 'utf8');
	return {
		file,
		existingContents,
		isNew: false,
		hasChanged: file.contents !== existingContents,
	};
};

export const findGenModules = (
	inputPaths: string[] = [paths.source],
	extensions: string[] = [GEN_FILE_PATTERN],
	rootDirs: string[] = [],
) =>
	findModules(
		inputPaths,
		(id) => findFiles(id, (file) => isGenPath(file.path)),
		(inputPath) => getPossibleSourceIds(inputPath, extensions, rootDirs),
	);
