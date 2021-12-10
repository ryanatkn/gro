import {type ModuleMeta, loadModule, type LoadModuleResult, findModules} from '../fs/modules.js';
import {type Gen, type GenResults, type GenFile, isGenPath, GEN_FILE_PATTERN} from './gen.js';
import {getPossibleSourceIds} from '../fs/inputPath.js';
import {paths} from '../paths.js';
import type {Filesystem} from 'src/fs/filesystem.js';

export interface GenModule {
	gen: Gen;
}

export interface GenModuleMeta extends ModuleMeta<GenModule> {}

export const validateGenModule = (mod: Record<string, any>): mod is GenModule =>
	typeof mod.gen === 'function';

export const loadGenModule = (id: string): Promise<LoadModuleResult<GenModuleMeta>> =>
	loadModule(id, true, validateGenModule);

export type CheckGenModuleResult =
	| {
			file: GenFile;
			existingContent: string;
			isNew: false;
			hasChanged: boolean;
	  }
	| {
			file: GenFile;
			existingContent: null;
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
			existingContent: null,
			isNew: true,
			hasChanged: true,
		};
	}
	const existingContent = await fs.readFile(file.id, 'utf8');
	return {
		file,
		existingContent,
		isNew: false,
		hasChanged: file.content !== existingContent,
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
