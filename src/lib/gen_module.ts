import type {Timings} from '@ryanatkn/belt/timings.js';
import type {Result} from '@ryanatkn/belt/result.js';
import {red} from 'kleur/colors';

import {type Module_Meta, load_module, type Load_Module_Result} from './modules.js';
import type {Gen} from './gen.js';
import {
	Input_Path,
	resolve_input_files,
	resolve_input_paths,
	type Resolved_Input_File,
	type Resolved_Input_Path,
} from './input_path.js';
import {paths, print_path} from './paths.js';
import {search_fs} from './search_fs.js';

export const GEN_FILE_PATTERN_TEXT = 'gen';
export const GEN_FILE_PATTERN = '.' + GEN_FILE_PATTERN_TEXT + '.';

export const is_gen_path = (path: string): boolean => path.includes(GEN_FILE_PATTERN);

export const GEN_SCHEMA_FILE_PATTERN_TEXT = 'schema';
export const GEN_SCHEMA_FILE_PATTERN = '.' + GEN_SCHEMA_FILE_PATTERN_TEXT + '.';
export const GEN_SCHEMA_PATH_SUFFIX = GEN_SCHEMA_FILE_PATTERN + 'ts';
export const GEN_SCHEMA_IDENTIFIER_SUFFIX = 'Schema';

export type Gen_Module_Type = 'basic';
export type Gen_Module = Basic_Gen_Module | Schema_Gen_Module;
export interface Basic_Gen_Module {
	gen: Gen;
}
export interface Schema_Gen_Module extends Basic_Gen_Module {
	[key: string]: unknown;
}

// TODO remove if not used, but we may generic stuff from Zod schemas or other things
export const to_gen_module_type = (_filename: string): Gen_Module_Type => 'basic';

export const gen_module_meta: Record<Gen_Module_Type, {pattern: string; text: string}> = {
	basic: {pattern: GEN_FILE_PATTERN, text: GEN_FILE_PATTERN_TEXT},
};

export const validate_gen_module = {
	basic: (mod: Record<string, any>): mod is Basic_Gen_Module => typeof mod?.gen === 'function',
	schema: (mod: Record<string, any>): mod is Schema_Gen_Module => !!mod,
};

export type Gen_Module_Meta = Basic_Gen_Module_Meta;
export interface Basic_Gen_Module_Meta extends Module_Meta<Gen_Module> {
	type: 'basic'; // TODO this is no longer used
	mod: Basic_Gen_Module;
}

export const load_gen_module = async (id: string): Promise<Load_Module_Result<Gen_Module_Meta>> => {
	const type = to_gen_module_type(id);
	const result = await load_module(id, validate_gen_module[type]);
	if (result.ok) {
		(result.mod as Gen_Module_Meta).type = type;
	}
	return result as Load_Module_Result<Gen_Module_Meta>;
};

export type Find_Genfiles_Result = Result<
	{
		// TODO BLOCK should these be bundled into a single data structure?
		resolved_input_files: Resolved_Input_File[];
		resolved_input_files_by_input_path: Map<Input_Path, Resolved_Input_File[]>;
		resolved_input_paths: Resolved_Input_Path[];
		resolved_input_path_by_input_path: Map<Input_Path, Resolved_Input_Path>;
	},
	Find_Genfiles_Failure
>;
export type Find_Genfiles_Failure =
	| {
			type: 'unmapped_input_paths';
			unmapped_input_paths: Input_Path[];
			resolved_input_paths: Resolved_Input_Path[];
			resolved_input_path_by_input_path: Map<Input_Path, Resolved_Input_Path>;
			reasons: string[];
	  }
	| {
			type: 'input_directories_with_no_files';
			input_directories_with_no_files: Resolved_Input_Path[];
			resolved_input_files: Resolved_Input_File[];
			resolved_input_files_by_input_path: Map<Input_Path, Resolved_Input_File[]>;
			resolved_input_paths: Resolved_Input_Path[];
			resolved_input_path_by_input_path: Map<Input_Path, Resolved_Input_Path>;
			reasons: string[];
	  };

/**
 * Finds modules from input paths. (see `src/lib/input_path.ts` for more)
 */
export const find_genfiles = async (
	input_paths: Input_Path[] = [paths.source],
	timings?: Timings,
): Promise<Find_Genfiles_Result> => {
	// TODO improve this API to allow config, maybe just a simple `gen` filter function, so the user could return a Rollup pluginutils filter,
	// gets a little tricky with the `get_possible_paths` API usage, which would probably need to change
	const extensions: string[] = [GEN_FILE_PATTERN, GEN_SCHEMA_FILE_PATTERN];
	const root_dirs: string[] = [];

	// Check which extension variation works - if it's a directory, prefer others first!
	const timing_to_resolve_input_paths = timings?.start('resolve input paths');
	const {resolved_input_paths, unmapped_input_paths} = await resolve_input_paths(
		input_paths,
		root_dirs,
		extensions,
	);
	console.log('[find_modules]', resolved_input_paths);
	timing_to_resolve_input_paths?.();

	const resolved_input_path_by_input_path = new Map(
		resolved_input_paths.map((r) => [r.input_path, r]),
	);

	// Error if any input path could not be mapped.
	if (unmapped_input_paths.length) {
		return {
			ok: false,
			type: 'unmapped_input_paths',
			unmapped_input_paths,
			resolved_input_paths,
			resolved_input_path_by_input_path,
			reasons: unmapped_input_paths.map((input_path) =>
				red(`Input path ${print_path(input_path)} cannot be mapped to a file or directory.`),
			),
		};
	}

	// Find all of the files for any directories.
	const timing_to_search_fs = timings?.start('find files');
	const {
		resolved_input_files,
		resolved_input_files_by_input_path,
		input_directories_with_no_files,
	} = await resolve_input_files(resolved_input_paths, (id) =>
		search_fs(id, {filter: (path) => extensions.some((e) => path.includes(e))}),
	);
	timing_to_search_fs?.();

	// Error if any input path has no files. (means we have an empty directory)
	if (input_directories_with_no_files.length) {
		return {
			ok: false,
			type: 'input_directories_with_no_files',
			input_directories_with_no_files,
			resolved_input_files,
			resolved_input_files_by_input_path,
			resolved_input_paths,
			resolved_input_path_by_input_path,
			reasons: input_directories_with_no_files.map(({input_path}) =>
				red(
					`Input directory ${print_path(
						resolved_input_path_by_input_path.get(input_path)!.id,
					)} contains no matching files.`,
				),
			),
		};
	}

	return {
		ok: true,
		resolved_input_files,
		resolved_input_files_by_input_path,
		resolved_input_paths,
		resolved_input_path_by_input_path,
	};
};
