import {Module_Meta, loadModule, Load_Module_Result, find_modules} from '../fs/modules.js';
import {Gen, GenResults, GenFile, isGenPath, GEN_FILE_PATTERN} from './gen.js';
import {get_possible_source_ids} from '../fs/input_path.js';
import {paths} from '../paths.js';
import type {Filesystem} from '../fs/filesystem.js';

export interface GenModule {
	gen: Gen;
}

export interface GenModule_Meta extends Module_Meta<GenModule> {}

export const validateGenModule = (mod: Record<string, any>): mod is GenModule =>
	typeof mod.gen === 'function';

export const loadGenModule = (id: string): Promise<Load_Module_Result<GenModule_Meta>> =>
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

export const find_gen_modules = (
	fs: Filesystem,
	input_paths: string[] = [paths.source],
	extensions: string[] = [GEN_FILE_PATTERN],
	root_dirs: string[] = [],
) =>
	find_modules(
		fs,
		input_paths,
		(id) => fs.findFiles(id, (file) => isGenPath(file.path)),
		(input_path) => get_possible_source_ids(input_path, extensions, root_dirs),
	);
