import type {Logger} from '@ryanatkn/belt/log.js';
import {join, basename, dirname, isAbsolute} from 'node:path';
import {z} from 'zod';

import {gen_module_meta, to_gen_module_type} from './gen_module.js';
import type {Source_Id} from './paths.js';
import type {Gro_Config} from './config.js';

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

export const to_gen_result = (origin_id: Source_Id, raw_result: Raw_Gen_Result): Gen_Result => {
	return {
		origin_id,
		files: to_gen_files(origin_id, raw_result),
	};
};

const to_gen_files = (origin_id: Source_Id, raw_result: Raw_Gen_Result): Gen_File[] => {
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

const to_gen_file = (origin_id: Source_Id, raw_gen_file: Raw_Gen_File): Gen_File => {
	const {content, filename, format = true} = raw_gen_file;
	const id = to_output_file_id(origin_id, filename);
	return {id, content, origin_id, format};
};

const to_output_file_id = (origin_id: Source_Id, raw_file_name: string | undefined): string => {
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
	const {pattern, text} = gen_module_meta[to_gen_module_type(filename)];
	const parts = filename.split('.');
	const gen_pattern_index = parts.indexOf(text);
	if (gen_pattern_index === -1) {
		throw Error(`Invalid gen file name - '${text}' not found in '${filename}'`);
	}
	if (gen_pattern_index !== parts.lastIndexOf(text)) {
		throw Error(`Invalid gen file name - multiple instances of '${text}' found in '${filename}'`);
	}
	if (gen_pattern_index < parts.length - 3) {
		// This check is technically unneccessary,
		// but ensures a consistent file naming convention.
		throw Error(
			`Invalid gen file name - only one additional extension is allowed to follow '${pattern}' in '${filename}'`,
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
