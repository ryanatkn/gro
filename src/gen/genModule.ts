import {ModuleMeta, loadModule, LoadModuleResult} from '../fs/modules.js';
import {Gen, GenResults, GenFile} from './gen.js';
import {pathExists, readFile} from '../fs/nodeFs.js';

export interface GenModule {
	gen: Gen;
}

export interface GenModuleMeta extends ModuleMeta<GenModule> {}

export const validateGenModule = (mod: Obj): mod is GenModule =>
	typeof mod.gen === 'function';

export const loadGenModule = (
	id: string,
): Promise<LoadModuleResult<GenModuleMeta>> =>
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
	genResults: GenResults,
): Promise<CheckGenModuleResult[]> => {
	return Promise.all(
		genResults.successes
			.map(result => result.files.map(file => checkGenModule(file)))
			.flat(),
	);
};

export const checkGenModule = async (
	file: GenFile,
): Promise<CheckGenModuleResult> => {
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
