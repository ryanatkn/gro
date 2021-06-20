import type {Logger} from '@feltcoop/felt/util/log';
import {join, basename, dirname} from 'path';

import type {Filesystem} from '../fs/filesystem.js';
import {is_source_id} from '../paths.js';

// TODO consider splitting the primitive data/helpers/types
// out of this module like how `task` is separated from `run_task`
export const GEN_FILE_SEPARATOR = '.';
export const GEN_FILE_PATTERN_TEXT = 'gen';
export const GEN_FILE_PATTERN = GEN_FILE_SEPARATOR + GEN_FILE_PATTERN_TEXT + GEN_FILE_SEPARATOR; // TODO regexp?

export const is_gen_path = (path: string): boolean => path.includes(GEN_FILE_PATTERN);

export type Gen_Result = {
	origin_id: string;
	files: Gen_File[];
};
export interface Gen_File {
	id: string;
	contents: string;
	origin_id: string;
}

export interface Gen {
	(ctx: Gen_Context): Raw_Gen_Result | Promise<Raw_Gen_Result>;
}
export interface Gen_Context {
	fs: Filesystem;
	origin_id: string;
	log: Logger;
}
// TODO consider other return data - metadata? effects? non-file build artifacts?
export type Raw_Gen_Result = string | Raw_Gen_File | Raw_Gen_File[];
export interface Raw_Gen_File {
	contents: string;
	// Defaults to file name without the `.gen`, and can be a relative path.
	// TODO maybe support a transform pattern or callback fn? like '[stem].thing.[ext]'
	filename?: string;
}

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

export const to_gen_result = (origin_id: string, raw_result: Raw_Gen_Result): Gen_Result => {
	if (!is_source_id(origin_id)) {
		throw Error(`origin_id must be a source id: ${origin_id}`);
	}
	return {
		origin_id,
		files: to_gen_files(origin_id, raw_result),
	};
};

const to_gen_files = (origin_id: string, raw_result: Raw_Gen_Result): Gen_File[] => {
	if (typeof raw_result === 'string') {
		return [to_gen_file(origin_id, {contents: raw_result})];
	} else if (Array.isArray(raw_result)) {
		const files = raw_result.map((f) => to_gen_file(origin_id, f));
		validate_gen_files(files);
		return files;
	} else {
		return [to_gen_file(origin_id, raw_result)];
	}
};

const to_gen_file = (origin_id: string, rawGen_File: Raw_Gen_File): Gen_File => {
	const {contents, filename} = rawGen_File;
	const id = to_output_file_id(origin_id, filename);
	return {id, contents, origin_id};
};

const to_output_file_id = (origin_id: string, raw_file_name: string | undefined): string => {
	if (raw_file_name === '') {
		throw Error(`Output file name cannot be an empty string`);
	}
	const filename = raw_file_name || to_output_file_name(basename(origin_id));
	const dir = dirname(origin_id);
	const output_file_id = join(dir, filename);
	if (output_file_id === origin_id) {
		throw Error('Gen origin and output file ids cannot be the same');
	}
	return output_file_id;
};

export const to_output_file_name = (filename: string): string => {
	const parts = filename.split(GEN_FILE_SEPARATOR);
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
	return final_parts.join(GEN_FILE_SEPARATOR);
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
