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

export const toGenModuleType = (filename: string): GenModuleType =>
	filename.includes(GEN_SCHEMA_FILE_PATTERN) ? 'schema' : 'basic';

export const genModuleMeta: Record<GenModuleType, {pattern: string; text: string}> = {
	basic: {pattern: GEN_FILE_PATTERN, text: GEN_FILE_PATTERN_TEXT},
	schema: {pattern: GEN_SCHEMA_FILE_PATTERN, text: GEN_SCHEMA_FILE_PATTERN_TEXT},
};

export const validateGenModule = {
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

export const loadGenModule = async (id: string): Promise<LoadModuleResult<GenModuleMeta>> => {
	const type = toGenModuleType(id);
	const result = await load_module(id, validateGenModule[type]);
	if (result.ok) {
		(result.mod as GenModuleMeta).type = type;
	}
	return result as LoadModuleResult<GenModuleMeta>;
};

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
