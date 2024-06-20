import type {Logger} from '@ryanatkn/belt/log.js';
import {join, basename, dirname, isAbsolute} from 'node:path';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {z} from 'zod';
import type {Result} from '@ryanatkn/belt/result.js';
import type {Timings} from '@ryanatkn/belt/timings.js';
import {red} from 'kleur/colors';

import {paths, print_path} from './paths.js';
import type {Path_Id} from './path.js';
import type {Gro_Config} from './config.js';
import {exists} from './fs.js';
import type {Parsed_Sveltekit_Config} from './sveltekit_config.js';
import {load_modules, type Load_Module_Failure, type Module_Meta} from './modules.js';
import {
	Input_Path,
	resolve_input_files,
	resolve_input_paths,
	type Resolved_Input_File,
	type Resolved_Input_Path,
} from './input_path.js';
import {search_fs} from './search_fs.js';

export const GEN_FILE_PATTERN_TEXT = 'gen';
export const GEN_FILE_PATTERN = '.' + GEN_FILE_PATTERN_TEXT + '.';

export const is_gen_path = (path: string): boolean => path.includes(GEN_FILE_PATTERN);

export type Gen_Result = {
	origin_id: Path_Id;
	files: Gen_File[];
};
export interface Gen_File {
	id: Path_Id;
	content: string;
	origin_id: Path_Id;
	format: boolean;
}

export interface Gen {
	(ctx: Gen_Context): Raw_Gen_Result | Promise<Raw_Gen_Result>;
}
export interface Gen_Context {
	config: Gro_Config;
	sveltekit_config: Parsed_Sveltekit_Config;
	/**
	 * Same as `import.meta.url` but in path form.
	 */
	origin_id: Path_Id;
	log: Logger;
}
// TODO consider other return data - metadata? effects? non-file build artifacts?
export type Raw_Gen_Result = string | Raw_Gen_File | null | Raw_Gen_Result[];
export interface Raw_Gen_File {
	content: string;
	// Defaults to file name without the `.gen`, and can be a relative path.
	// TODO maybe support a transform pattern or callback fn? like '[stem].thing.[ext]'
	filename?: string;
	format?: boolean; // defaults to `true`
}

export const Gen_Config = z.object({
	imports: z.record(z.string(), z.string()).default({}),
});
export type Gen_Config = z.infer<typeof Gen_Config>;

export type Gen_Results = {
	results: Genfile_Module_Result[];
	successes: Genfile_Module_Result_Success[];
	failures: Genfile_Module_Result_Failure[];
	input_count: number;
	output_count: number;
	elapsed: number;
};
export type Genfile_Module_Result = Genfile_Module_Result_Success | Genfile_Module_Result_Failure;
export type Genfile_Module_Result_Success = {
	ok: true;
	id: Path_Id;
	files: Gen_File[];
	elapsed: number;
};
export type Genfile_Module_Result_Failure = {
	ok: false;
	id: Path_Id;
	reason: string;
	error: Error;
	elapsed: number;
};

export const to_gen_result = (origin_id: Path_Id, raw_result: Raw_Gen_Result): Gen_Result => {
	return {
		origin_id,
		files: to_gen_files(origin_id, raw_result),
	};
};

const to_gen_files = (origin_id: Path_Id, raw_result: Raw_Gen_Result): Gen_File[] => {
	if (raw_result === null) {
		return [];
	} else if (typeof raw_result === 'string') {
		return [to_gen_file(origin_id, {content: raw_result})];
	} else if (Array.isArray(raw_result)) {
		const files = raw_result.flatMap((f) => to_gen_files(origin_id, f));
		validate_gen_files(files);
		return files;
	}
	return [to_gen_file(origin_id, raw_result)];
};

const to_gen_file = (origin_id: Path_Id, raw_gen_file: Raw_Gen_File): Gen_File => {
	const {content, filename, format = true} = raw_gen_file;
	const id = to_output_file_id(origin_id, filename);
	return {id, content, origin_id, format};
};

const to_output_file_id = (origin_id: Path_Id, raw_file_name: string | undefined): string => {
	if (raw_file_name === '') {
		throw Error(`Output file name cannot be an empty string`);
	}
	const filename = raw_file_name || to_output_file_name(basename(origin_id));
	if (isAbsolute(filename)) return filename;
	const dir = dirname(origin_id);
	const output_file_id = join(dir, filename);
	if (output_file_id === origin_id) {
		throw Error('Gen origin and output file ids cannot be the same');
	}
	return output_file_id;
};

export const to_output_file_name = (filename: string): string => {
	const parts = filename.split('.');
	const gen_pattern_index = parts.indexOf(GEN_FILE_PATTERN_TEXT);
	if (gen_pattern_index === -1) {
		throw Error(`Invalid gen file name - '${GEN_FILE_PATTERN_TEXT}' not found in '${filename}'`);
	}
	if (gen_pattern_index !== parts.lastIndexOf(GEN_FILE_PATTERN_TEXT)) {
		throw Error(
			`Invalid gen file name - multiple instances of '${GEN_FILE_PATTERN_TEXT}' found in '${filename}'`,
		);
	}
	if (gen_pattern_index < parts.length - 3) {
		// This check is technically unneccessary,
		// but ensures a consistent file naming convention.
		throw Error(
			`Invalid gen file name - only one additional extension is allowed to follow '${GEN_FILE_PATTERN}' in '${filename}'`,
		);
	}
	const final_parts: string[] = [];
	const has_different_ext = gen_pattern_index === parts.length - 3;
	const length = has_different_ext ? parts.length - 1 : parts.length;
	for (let i = 0; i < length; i++) {
		if (i === gen_pattern_index) continue; // skip the `.gen.` pattern
		if (i === length - 1 && parts[i] === '') continue; // allow empty extension
		final_parts.push(parts[i]);
	}
	return final_parts.join('.');
};

const validate_gen_files = (files: Gen_File[]) => {
	const ids = new Set();
	for (const file of files) {
		if (ids.has(file.id)) {
			throw Error(`Duplicate gen file id: ${file.id}`);
		}
		ids.add(file.id);
	}
};

export type Analyzed_Gen_Result =
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

export const analyze_gen_results = (gen_results: Gen_Results): Promise<Analyzed_Gen_Result[]> =>
	Promise.all(
		gen_results.successes
			.map((result) => result.files.map((file) => analyze_gen_result(file)))
			.flat(),
	);

export const analyze_gen_result = async (file: Gen_File): Promise<Analyzed_Gen_Result> => {
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

export const write_gen_results = async (
	gen_results: Gen_Results,
	analyzed_gen_results: Analyzed_Gen_Result[],
	log: Logger,
): Promise<void> => {
	await Promise.all(
		gen_results.successes
			.map((result) =>
				result.files.map(async (file) => {
					const analyzed = analyzed_gen_results.find((r) => r.file.id === file.id);
					if (!analyzed) throw Error('Expected to find analyzed result: ' + file.id);
					const log_args = [print_path(file.id), 'generated from', print_path(file.origin_id)];
					if (analyzed.is_new) {
						log.info('writing new', ...log_args);
						await mkdir(dirname(file.id), {recursive: true});
						await writeFile(file.id, file.content);
					} else if (analyzed.has_changed) {
						log.info('writing changed', ...log_args);
						await writeFile(file.id, file.content);
					} else {
						log.info('skipping unchanged', ...log_args);
					}
				}),
			)
			.flat(),
	);
};

export interface Found_Genfiles {
	resolved_input_files: Resolved_Input_File[];
	resolved_input_files_by_input_path: Map<Input_Path, Resolved_Input_File[]>;
	resolved_input_paths: Resolved_Input_Path[];
	resolved_input_path_by_input_path: Map<Input_Path, Resolved_Input_Path>;
}

export type Find_Genfiles_Result = Result<{value: Found_Genfiles}, Find_Genfiles_Failure>;
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
	const extensions: string[] = [GEN_FILE_PATTERN];
	const root_dirs: string[] = [];

	// Check which extension variation works - if it's a directory, prefer others first!
	const timing_to_resolve_input_paths = timings?.start('resolve input paths');
	const {resolved_input_paths, unmapped_input_paths} = await resolve_input_paths(
		input_paths,
		root_dirs,
		extensions,
	);
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
		value: {
			resolved_input_files,
			resolved_input_files_by_input_path,
			resolved_input_paths,
			resolved_input_path_by_input_path,
		},
	};
};

// TODO BLOCK this and other `Gen_` to `Genfile_`?
export interface Genfile_Module {
	gen: Gen;
}

export type Genfile_Module_Meta = Module_Meta<Genfile_Module>;

export interface Loaded_Genfiles {
	modules: Genfile_Module_Meta[];
	found_genfiles: Found_Genfiles;
}

// TODO BLOCK messy with Load_Modules equivalents, extend the parts of `Load_Modules_Result` to dry ths up and just pass the Genfile_Module_Meta param, same as in task module
export type Load_Genfiles_Result = Result<{value: Loaded_Genfiles}, Load_Genfiles_Failure>;
export type Load_Genfiles_Failure = {
	type: 'load_module_failures';
	load_module_failures: Load_Module_Failure[];
	reasons: string[];
	// still return the modules and timings, deferring to the caller
	modules: Genfile_Module_Meta[];
};

export const load_genfiles = async (
	found_genfiles: Found_Genfiles,
	timings?: Timings,
): Promise<Load_Genfiles_Result> => {
	// TODO BLOCK refactor
	const loaded_modules = await load_modules(
		found_genfiles.resolved_input_files,
		validate_gen_module,
		(id, mod): Genfile_Module_Meta => ({id, mod}),
		timings,
	);
	if (!loaded_modules.ok) {
		return loaded_modules;
	}
	return {
		ok: true,
		value: {modules: loaded_modules.modules, found_genfiles},
	};
};

export const validate_gen_module = (mod: Record<string, any>): mod is Genfile_Module =>
	typeof mod?.gen === 'function';
