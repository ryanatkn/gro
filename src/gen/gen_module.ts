import {Module_Meta, loadModule, Load_Module_Result, find_modules} from '../fs/modules.js';
import {Gen, Gen_Results, GenFile, isGenPath, GEN_FILE_PATTERN} from './gen.js';
import {get_possible_source_ids} from '../fs/input_path.js';
import {paths} from '../paths.js';
import type {Filesystem} from '../fs/filesystem.js';

export interface GenModule {
	gen: Gen;
}

export interface Gen_Module_Meta extends Module_Meta<GenModule> {}

export const validateGenModule = (mod: Record<string, any>): mod is GenModule =>
	typeof mod.gen === 'function';

export const loadGenModule = (id: string): Promise<Load_Module_Result<Gen_Module_Meta>> =>
	loadModule(id, validateGenModule);

export type CheckGen_Module_Result =
	| {
			file: GenFile;
			existingContents: string;
			isNew: false;
			has_changed: boolean;
	  }
	| {
			file: GenFile;
			existingContents: null;
			isNew: true;
			has_changed: true;
	  };

export const checkGenModules = async (
	fs: Filesystem,
	genResults: Gen_Results,
): Promise<CheckGen_Module_Result[]> => {
	return Promise.all(
		genResults.successes
			.map((result) => result.files.map((file) => checkGenModule(fs, file)))
			.flat(),
	);
};

export const checkGenModule = async (
	fs: Filesystem,
	file: GenFile,
): Promise<CheckGen_Module_Result> => {
	if (!(await fs.exists(file.id))) {
		return {
			file,
			existingContents: null,
			isNew: true,
			has_changed: true,
		};
	}
	const existingContents = await fs.read_file(file.id, 'utf8');
	return {
		file,
		existingContents,
		isNew: false,
		has_changed: file.contents !== existingContents,
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
		(id) => fs.find_files(id, (file) => isGenPath(file.path)),
		(input_path) => get_possible_source_ids(input_path, extensions, root_dirs),
	);
