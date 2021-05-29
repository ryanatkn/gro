import {ModuleMeta, loadModule, LoadModuleResult, findModules} from '../fs/modules.js';
import {Gen, GenResults, GenFile, isGenPath, GEN_FILE_PATTERN} from './gen.js';
import {getPossibleSourceIds} from '../fs/inputPath.js';
import {paths} from '../paths.js';
import type {Filesystem} from '../fs/filesystem.js';

export interface GenModule {
	gen: Gen;
}

export interface GenModuleMeta extends ModuleMeta<GenModule> {}

export const validateGenModule = (mod: Record<string, any>): mod is GenModule =>
	typeof mod.gen === 'function';

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

export const checkGenModules = async (
	fs: Filesystem,
	genResults: GenResults,
): Promise<CheckGenModuleResult[]> => {
	return Promise.all(
		genResults.successes
			.map((result) => result.files.map((file) => checkGenModule(fs, file)))
			.flat(),
	);
};

export const checkGenModule = async (
	fs: Filesystem,
	file: GenFile,
): Promise<CheckGenModuleResult> => {
	if (!(await fs.exists(file.id))) {
		return {
			file,
			existingContents: null,
			isNew: true,
			hasChanged: true,
		};
	}
	const existingContents = await fs.readFile(file.id, 'utf8');
	return {
		file,
		existingContents,
		isNew: false,
		hasChanged: file.contents !== existingContents,
	};
};

export const findGenModules = (
	fs: Filesystem,
	inputPaths: string[] = [paths.source],
	extensions: string[] = [GEN_FILE_PATTERN],
	rootDirs: string[] = [],
) =>
	findModules(
		fs,
		inputPaths,
		(id) => fs.findFiles(id, (file) => isGenPath(file.path)),
		(inputPath) => getPossibleSourceIds(inputPath, extensions, rootDirs),
	);
