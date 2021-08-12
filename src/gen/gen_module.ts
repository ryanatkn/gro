import {ModuleMeta, load_module, LoadModuleResult, find_modules} from '../fs/modules.js';
import {Gen, GenResults, GenFile, is_gen_path, GEN_FILE_PATTERN} from './gen.js';
import {get_possible_source_ids} from '../fs/input_path.js';
import {paths} from '../paths.js';
import type {Filesystem} from 'src/fs/filesystem.js';

export interface GenModule {
	gen: Gen;
}

export interface GenModuleMeta extends ModuleMeta<GenModule> {}

export const validate_gen_module = (mod: Record<string, any>): mod is GenModule =>
	typeof mod.gen === 'function';

export const load_gen_module = (id: string): Promise<LoadModuleResult<GenModuleMeta>> =>
	load_module(id, true, validate_gen_module);

export type CheckGenModuleResult =
	| {
			file: GenFile;
			existing_content: string;
			is_new: false;
			has_changed: boolean;
	  }
	| {
			file: GenFile;
			existing_content: null;
			is_new: true;
			has_changed: true;
	  };

export const check_gen_modules = async (
	fs: Filesystem,
	gen_results: GenResults,
): Promise<CheckGenModuleResult[]> => {
	return Promise.all(
		gen_results.successes
			.map((result) => result.files.map((file) => check_gen_module(fs, file)))
			.flat(),
	);
};

export const check_gen_module = async (
	fs: Filesystem,
	file: GenFile,
): Promise<CheckGenModuleResult> => {
	if (!(await fs.exists(file.id))) {
		return {
			file,
			existing_content: null,
			is_new: true,
			has_changed: true,
		};
	}
	const existing_content = await fs.read_file(file.id, 'utf8');
	return {
		file,
		existing_content,
		is_new: false,
		has_changed: file.content !== existing_content,
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
		(id) => fs.find_files(id, (file) => is_gen_path(file.path)),
		(input_path) => get_possible_source_ids(input_path, extensions, root_dirs),
	);
