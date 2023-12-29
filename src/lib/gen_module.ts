import {readFile} from 'node:fs/promises';
import {strip_end} from '@grogarden/util/string.js';

import {
	type Module_Meta,
	load_module,
	type Load_Module_Result,
	find_modules,
	type Find_Modules_Result,
} from './modules.js';
import type {Gen, Gen_Results, Gen_File} from './gen.js';
import {get_possible_source_ids} from './input_path.js';
import {paths} from './paths.js';
import {search_fs} from './search_fs.js';
import {exists} from './fs.js';

export const GEN_FILE_PATTERN_TEXT = 'gen';
export const GEN_FILE_PATTERN = '.' + GEN_FILE_PATTERN_TEXT + '.';

export const is_gen_path = (path: string): boolean => path.includes(GEN_FILE_PATTERN);

export const GEN_SCHEMA_FILE_PATTERN_TEXT = 'schema';
export const GEN_SCHEMA_FILE_PATTERN = '.' + GEN_SCHEMA_FILE_PATTERN_TEXT + '.';
export const GEN_SCHEMA_PATH_SUFFIX = GEN_SCHEMA_FILE_PATTERN + 'ts';
export const GEN_SCHEMA_IDENTIFIER_SUFFIX = 'Schema';

/**
 * Convert a schema identifer to the final type identifier, e.g. `A_Schema` to `A`.
 */
export const to_gen_schema_name = (identifier: string): string => {
	const full_suffix = '_' + GEN_SCHEMA_IDENTIFIER_SUFFIX;
	return strip_end(
		identifier,
		identifier.endsWith(full_suffix) ? full_suffix : GEN_SCHEMA_IDENTIFIER_SUFFIX,
	);
};

export type Gen_Module_Type = 'basic' | 'schema';
export type Gen_Module = Basic_Gen_Module | Schema_Gen_Module;
export interface Basic_Gen_Module {
	gen: Gen;
}
export interface Schema_Gen_Module extends Basic_Gen_Module {
	[key: string]: unknown;
}

export const to_gen_module_type = (filename: string): Gen_Module_Type =>
	filename.includes(GEN_SCHEMA_FILE_PATTERN) ? 'schema' : 'basic';

export const gen_module_meta: Record<Gen_Module_Type, {pattern: string; text: string}> = {
	basic: {pattern: GEN_FILE_PATTERN, text: GEN_FILE_PATTERN_TEXT},
	schema: {pattern: GEN_SCHEMA_FILE_PATTERN, text: GEN_SCHEMA_FILE_PATTERN_TEXT},
};

export const validate_gen_module = {
	basic: (mod: Record<string, any>): mod is Basic_Gen_Module => typeof mod?.gen === 'function',
	schema: (mod: Record<string, any>): mod is Schema_Gen_Module => !!mod,
};

export type Gen_Module_Meta = Basic_Gen_Module_Meta | Schema_Gen_Module_Meta;
export interface Basic_Gen_Module_Meta extends Module_Meta<Gen_Module> {
	type: 'basic';
	mod: Basic_Gen_Module;
}
export interface Schema_Gen_Module_Meta extends Module_Meta<Gen_Module> {
	type: 'schema';
	mod: Schema_Gen_Module;
}

export const load_gen_module = async (id: string): Promise<Load_Module_Result<Gen_Module_Meta>> => {
	const type = to_gen_module_type(id);
	const result = await load_module(id, validate_gen_module[type]);
	if (result.ok) {
		(result.mod as Gen_Module_Meta).type = type;
	}
	return result as Load_Module_Result<Gen_Module_Meta>;
};

export type Check_Gen_Module_Result =
	| {
			file: Gen_File;
			existing_content: string;
			is_new: false;
			has_changed: boolean;
	  }
	| {
			file: Gen_File;
			existing_content: null;
			is_new: true;
			has_changed: true;
	  };

export const check_gen_modules = (gen_results: Gen_Results): Promise<Check_Gen_Module_Result[]> =>
	Promise.all(
		gen_results.successes
			.map((result) => result.files.map((file) => check_gen_module(file)))
			.flat(),
	);

export const check_gen_module = async (file: Gen_File): Promise<Check_Gen_Module_Result> => {
	if (!(await exists(file.id))) {
		return {
			file,
			existing_content: null,
			is_new: true,
			has_changed: true,
		};
	}
	const existing_content = await readFile(file.id, 'utf8');
	return {
		file,
		existing_content,
		is_new: false,
		has_changed: file.content !== existing_content,
	};
};

export const find_gen_modules = (
	input_paths: string[] = [paths.source],
	// TODO improve this API to allow config, maybe just a simple `gen` filter function, so the user could return a Rollup pluginutils filter,
	// gets a little tricky with the `get_possible_source_ids` API usage, which would probably need to change
	extensions: string[] = [GEN_FILE_PATTERN, GEN_SCHEMA_FILE_PATTERN],
	root_dirs: string[] = [],
): Promise<Find_Modules_Result> =>
	find_modules(
		input_paths,
		(id) => search_fs(id, {filter: (path) => extensions.some((e) => path.includes(e))}),
		(input_path) => get_possible_source_ids(input_path, extensions, root_dirs),
	);
