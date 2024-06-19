import type {Logger} from '@ryanatkn/belt/log.js';
import {join, basename, dirname, isAbsolute} from 'node:path';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {z} from 'zod';

import {print_path} from './paths.js';
import type {Path_Id} from './path.js';
import type {Gro_Config} from './config.js';
import {exists} from './fs.js';
import type {Parsed_Sveltekit_Config} from './sveltekit_config.js';
import {GEN_FILE_PATTERN, GEN_FILE_PATTERN_TEXT} from './gen_module.js';

export type Gen_Result = {
	origin_id: string;
	files: Gen_File[];
};
export interface Gen_File {
	id: string;
	content: string;
	origin_id: string;
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
	origin_id: string;
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
	results: Gen_Module_Result[];
	successes: Gen_Module_Result_Success[];
	failures: Gen_Module_Result_Failure[];
	input_count: number;
	output_count: number;
	elapsed: number;
};
export type Gen_Module_Result = Gen_Module_Result_Success | Gen_Module_Result_Failure;
export type Gen_Module_Result_Success = {
	ok: true;
	id: string;
	files: Gen_File[];
	elapsed: number;
};
export type Gen_Module_Result_Failure = {
	ok: false;
	id: string;
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
