import type {Logger} from '@ryanatkn/belt/log.js';
import {join, basename, dirname, isAbsolute} from 'node:path';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import type {Result} from '@ryanatkn/belt/result.js';
import type {Timings} from '@ryanatkn/belt/timings.js';
import {styleText as st} from 'node:util';
import {existsSync} from 'node:fs';

import {print_path} from './paths.ts';
import type {Path_Id} from './path.ts';
import type {Gro_Config} from './gro_config.ts';
import type {Parsed_Svelte_Config} from './svelte_config.ts';
import {load_modules, type Load_Modules_Failure, type Module_Meta} from './modules.ts';
import {
	Input_Path,
	resolve_input_files,
	resolve_input_paths,
	type Resolved_Input_File,
	type Resolved_Input_Path,
} from './input_path.ts';
import {search_fs} from './search_fs.ts';
import type {Filer} from './filer.ts';
import type {Invoke_Task} from './task.ts';

export const GEN_FILE_PATTERN_TEXT = 'gen';
export const GEN_FILE_PATTERN = '.' + GEN_FILE_PATTERN_TEXT + '.';

export const is_gen_path = (path: string): boolean => path.includes(GEN_FILE_PATTERN);

export interface Gen_Result {
	origin_id: Path_Id;
	files: Array<Gen_File>;
}
export interface Gen_File {
	id: Path_Id;
	content: string;
	origin_id: Path_Id;
	format: boolean;
}

export type Gen_Dependencies = 'all' | Gen_Dependencies_Config | Gen_Dependencies_Resolver;

export interface Gen_Dependencies_Config {
	patterns?: Array<RegExp>;
	files?: Array<Path_Id>;
}

export type Gen_Dependencies_Resolver = (
	ctx: Gen_Context,
) => Gen_Dependencies_Config | 'all' | null | Promise<Gen_Dependencies_Config | 'all' | null>;

export type Gen = Gen_Function | Gen_Config;

export type Gen_Function = (ctx: Gen_Context) => Raw_Gen_Result | Promise<Raw_Gen_Result>;

export interface Gen_Config {
	generate: Gen_Function;
	dependencies?: Gen_Dependencies;
	// TODO think about what could be added
	// cache?: boolean;
}

export interface Gen_Context {
	config: Gro_Config;
	svelte_config: Parsed_Svelte_Config;
	filer: Filer;
	log: Logger;
	timings: Timings;
	invoke_task: Invoke_Task;
	/**
	 * Same as `import.meta.url` but in path form.
	 */
	origin_id: Path_Id;
	/**
	 * The `origin_id` relative to the root dir.
	 */
	origin_path: string;
	/**
	 * The file that triggered dependency checking.
	 * Only available when resolving dependencies dynamically.
	 * `undefined` during actual generation.
	 */
	changed_file_id: Path_Id | undefined;
}

// TODO consider other return data - metadata? effects? non-file build artifacts?
export type Raw_Gen_Result = string | Raw_Gen_File | null | Array<Raw_Gen_Result>;
export interface Raw_Gen_File {
	content: string;
	// Defaults to file name without the `.gen`, and can be a relative path.
	// TODO maybe support a transform pattern or callback fn? like '[stem].thing.[ext]'
	filename?: string;
	format?: boolean; // defaults to `true`
}

export interface Gen_Results {
	results: Array<Genfile_Module_Result>;
	successes: Array<Genfile_Module_Result_Success>;
	failures: Array<Genfile_Module_Result_Failure>;
	input_count: number;
	output_count: number;
	elapsed: number;
}
export type Genfile_Module_Result = Genfile_Module_Result_Success | Genfile_Module_Result_Failure;
export interface Genfile_Module_Result_Success {
	ok: true;
	id: Path_Id;
	files: Array<Gen_File>;
	elapsed: number;
}
export interface Genfile_Module_Result_Failure {
	ok: false;
	id: Path_Id;
	reason: string;
	error: Error;
	elapsed: number;
}

export const to_gen_result = (origin_id: Path_Id, raw_result: Raw_Gen_Result): Gen_Result => {
	return {
		origin_id,
		files: to_gen_files(origin_id, raw_result),
	};
};

const to_gen_files = (origin_id: Path_Id, raw_result: Raw_Gen_Result): Array<Gen_File> => {
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
	const filename = raw_file_name ?? to_output_file_name(basename(origin_id));
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
	const final_parts: Array<string> = [];
	const has_different_ext = gen_pattern_index === parts.length - 3;
	const length = has_different_ext ? parts.length - 1 : parts.length;
	for (let i = 0; i < length; i++) {
		if (i === gen_pattern_index) continue; // skip the `.gen.` pattern
		if (i === length - 1 && parts[i] === '') continue; // allow empty extension
		final_parts.push(parts[i]);
	}
	return final_parts.join('.');
};

const validate_gen_files = (files: Array<Gen_File>) => {
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

export const analyze_gen_results = (
	gen_results: Gen_Results,
): Promise<Array<Analyzed_Gen_Result>> =>
	Promise.all(
		gen_results.successes
			.map((result) => result.files.map((file) => analyze_gen_result(file)))
			.flat(),
	);

export const analyze_gen_result = async (file: Gen_File): Promise<Analyzed_Gen_Result> => {
	if (!existsSync(file.id)) {
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
	analyzed_gen_results: Array<Analyzed_Gen_Result>,
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
	resolved_input_files: Array<Resolved_Input_File>;
	resolved_input_files_by_root_dir: Map<Path_Id, Array<Resolved_Input_File>>;
	resolved_input_paths: Array<Resolved_Input_Path>;
}

export type Find_Genfiles_Result = Result<{value: Found_Genfiles}, Find_Genfiles_Failure>;
export type Find_Genfiles_Failure =
	| {
			type: 'unmapped_input_paths';
			unmapped_input_paths: Array<Input_Path>;
			resolved_input_paths: Array<Resolved_Input_Path>;
			reasons: Array<string>;
	  }
	| {
			type: 'input_directories_with_no_files';
			input_directories_with_no_files: Array<Input_Path>;
			resolved_input_files: Array<Resolved_Input_File>;
			resolved_input_files_by_root_dir: Map<Path_Id, Array<Resolved_Input_File>>;
			resolved_input_paths: Array<Resolved_Input_Path>;
			reasons: Array<string>;
	  };

/**
 * Finds modules from input paths. (see `src/lib/input_path.ts` for more)
 */
export const find_genfiles = (
	input_paths: Array<Input_Path>,
	root_dirs: Array<Path_Id>,
	config: Gro_Config,
	timings?: Timings,
): Find_Genfiles_Result => {
	const extensions: Array<string> = [GEN_FILE_PATTERN];

	// Check which extension variation works - if it's a directory, prefer others first!
	const timing_to_resolve_input_paths = timings?.start('resolve input paths');
	const {resolved_input_paths, unmapped_input_paths} = resolve_input_paths(
		input_paths,
		root_dirs,
		extensions,
	);
	timing_to_resolve_input_paths?.();

	// Error if any input path could not be mapped.
	if (unmapped_input_paths.length) {
		return {
			ok: false,
			type: 'unmapped_input_paths',
			unmapped_input_paths,
			resolved_input_paths,
			reasons: unmapped_input_paths.map((input_path) =>
				st('red', `Input path ${print_path(input_path)} cannot be mapped to a file or directory.`),
			),
		};
	}

	// Find all of the files for any directories.
	const timing_to_search_fs = timings?.start('find files');
	const {resolved_input_files, resolved_input_files_by_root_dir, input_directories_with_no_files} =
		resolve_input_files(resolved_input_paths, (id) =>
			search_fs(id, {
				filter: config.search_filters,
				file_filter: (p) => extensions.some((e) => p.includes(e)),
			}),
		);
	timing_to_search_fs?.();

	// Error if any input path has no files. (means we have an empty directory)
	if (input_directories_with_no_files.length) {
		return {
			ok: false,
			type: 'input_directories_with_no_files',
			input_directories_with_no_files,
			resolved_input_files,
			resolved_input_files_by_root_dir,
			resolved_input_paths,
			reasons: input_directories_with_no_files.map((input_path) =>
				st('red', `Input directory contains no matching files: ${print_path(input_path)}`),
			),
		};
	}

	return {
		ok: true,
		value: {
			resolved_input_files,
			resolved_input_files_by_root_dir,
			resolved_input_paths,
		},
	};
};

export interface Genfile_Module {
	gen: Gen;
}

export type Genfile_Module_Meta = Module_Meta<Genfile_Module>;

export interface Loaded_Genfiles {
	modules: Array<Genfile_Module_Meta>;
	found_genfiles: Found_Genfiles;
}

export type Load_Genfiles_Result = Result<{value: Loaded_Genfiles}, Load_Genfiles_Failure>;
export type Load_Genfiles_Failure = Load_Modules_Failure<Genfile_Module_Meta>;

export const load_genfiles = async (
	found_genfiles: Found_Genfiles,
	timings?: Timings,
): Promise<Load_Genfiles_Result> => {
	const loaded_modules = await load_modules(
		found_genfiles.resolved_input_files,
		validate_gen_module,
		(resolved_input_file, mod): Genfile_Module_Meta => ({id: resolved_input_file.id, mod}),
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

export const validate_gen_module = (mod: Record<string, any>): mod is Genfile_Module => {
	if (typeof mod.gen === 'function') return true;
	if (typeof mod.gen === 'object' && mod.gen !== null && typeof mod.gen.generate === 'function') {
		return true;
	}
	return false;
};

export const normalize_gen_config = (gen: Gen): Gen_Config =>
	typeof gen === 'function' ? {generate: gen} : gen;
