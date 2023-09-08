import {
	type ModuleMeta,
	load_module,
	type LoadModuleResult,
	find_modules,
	type FindModulesResult,
} from '../fs/modules.js';
import type {Gen, GenResults, GenFile} from './gen.js';
import {get_possible_source_ids} from '../path/input_path.js';
import {paths} from '../path/paths.js';
import type {Filesystem} from '../fs/filesystem.js';

export const GEN_FILE_PATTERN_TEXT = 'gen';
export const GEN_FILE_PATTERN = '.' + GEN_FILE_PATTERN_TEXT + '.';

export const is_gen_path = (path: string): boolean => path.includes(GEN_FILE_PATTERN);

export const GEN_SCHEMA_FILE_PATTERN_TEXT = 'schema';
export const GEN_SCHEMA_FILE_PATTERN = '.' + GEN_SCHEMA_FILE_PATTERN_TEXT + '.';
export const GEN_SCHEMA_PATH_SUFFIX = GEN_SCHEMA_FILE_PATTERN + 'ts';
export const GEN_SCHEMA_IDENTIFIER_SUFFIX = 'Schema';

export type GenModuleType = 'basic' | 'schema';
export type GenModule = BasicGenModule | SchemaGenModule;
export interface BasicGenModule {
	gen: Gen;
}
export interface SchemaGenModule extends BasicGenModule {
	[key: string]: unknown;
}

export const to_gen_module_type = (filename: string): GenModuleType =>
	filename.includes(GEN_SCHEMA_FILE_PATTERN) ? 'schema' : 'basic';

export const gen_module_meta: Record<GenModuleType, {pattern: string; text: string}> = {
	basic: {pattern: GEN_FILE_PATTERN, text: GEN_FILE_PATTERN_TEXT},
	schema: {pattern: GEN_SCHEMA_FILE_PATTERN, text: GEN_SCHEMA_FILE_PATTERN_TEXT},
};

export const validate_gen_module = {
	basic: (mod: Record<string, any>): mod is BasicGenModule => typeof mod?.gen === 'function',
	schema: (mod: Record<string, any>): mod is SchemaGenModule => !!mod,
};

export type GenModuleMeta = BasicGenModuleMeta | SchemaGenModuleMeta;
export interface BasicGenModuleMeta extends ModuleMeta<GenModule> {
	type: 'basic';
	mod: BasicGenModule;
}
export interface SchemaGenModuleMeta extends ModuleMeta<GenModule> {
	type: 'schema';
	mod: SchemaGenModule;
}

export const load_gen_module = async (id: string): Promise<LoadModuleResult<GenModuleMeta>> => {
	const type = to_gen_module_type(id);
	const result = await load_module(id, validate_gen_module[type]);
	if (result.ok) {
		(result.mod as GenModuleMeta).type = type;
	}
	return result as LoadModuleResult<GenModuleMeta>;
};

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

export const checkGenModules = async (
	fs: Filesystem,
	gen_results: GenResults,
): Promise<CheckGenModuleResult[]> => {
	return Promise.all(
		gen_results.successes
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
			existing_content: null,
			is_new: true,
			has_changed: true,
		};
	}
	const existing_content = await fs.readFile(file.id, 'utf8');
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
	extensions: string[] = [GEN_FILE_PATTERN, GEN_SCHEMA_FILE_PATTERN],
	root_dirs: string[] = [],
): Promise<FindModulesResult> =>
	find_modules(
		fs,
		input_paths,
		(id) => fs.findFiles(id, (path) => extensions.some((e) => path.includes(e))),
		(input_path) => get_possible_source_ids(input_path, extensions, root_dirs),
	);
