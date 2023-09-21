import type {Logger} from '@feltjs/util/log.js';
import {join, basename, dirname} from 'node:path';
import {z} from 'zod';

import {gen_module_meta, to_gen_module_type} from './gen_module.js';
import type {SourceId} from './paths.js';

export type GenResult = {
	origin_id: string;
	files: GenFile[];
};
export interface GenFile {
	id: string;
	content: string;
	origin_id: string;
	format: boolean;
}

export interface Gen {
	(ctx: GenContext): RawGenResult | Promise<RawGenResult>;
}
export interface GenContext {
	origin_id: string;
	log: Logger;
	imports: Record<string, string>;
}
// TODO consider other return data - metadata? effects? non-file build artifacts?
export type RawGenResult = string | RawGenFile | null | RawGenResult[];
export interface RawGenFile {
	content: string;
	// Defaults to file name without the `.gen` or `.schema`, and can be a relative path.
	// TODO maybe support a transform pattern or callback fn? like '[stem].thing.[ext]'
	filename?: string;
	format?: boolean; // defaults to `true`
}

export const GenConfig = z.object({
	imports: z.record(z.string(), z.string()).default({}),
});
export type GenConfig = z.infer<typeof GenConfig>;

export type GenResults = {
	results: GenModuleResult[];
	successes: GenModuleResultSuccess[];
	failures: GenModuleResultFailure[];
	input_count: number;
	output_count: number;
	elapsed: number;
};
export type GenModuleResult = GenModuleResultSuccess | GenModuleResultFailure;
export type GenModuleResultSuccess = {
	ok: true;
	id: string;
	files: GenFile[];
	elapsed: number;
};
export type GenModuleResultFailure = {
	ok: false;
	id: string;
	reason: string;
	error: Error;
	elapsed: number;
};

export const to_gen_result = (origin_id: SourceId, raw_result: RawGenResult): GenResult => {
	return {
		origin_id,
		files: to_gen_files(origin_id, raw_result),
	};
};

const to_gen_files = (origin_id: SourceId, raw_result: RawGenResult): GenFile[] => {
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

const to_gen_file = (origin_id: SourceId, raw_gen_file: RawGenFile): GenFile => {
	const {content, filename, format = true} = raw_gen_file;
	const id = to_output_file_id(origin_id, filename);
	return {id, content, origin_id, format};
};

const to_output_file_id = (origin_id: SourceId, raw_file_name: string | undefined): string => {
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
		if (i === gen_pattern_index) continue; // skip the `.gen.` or `.schema.` pattern
		if (i === length - 1 && parts[i] === '') continue; // allow empty extension
		final_parts.push(parts[i]);
	}
	return final_parts.join('.');
};

const validate_gen_files = (files: GenFile[]) => {
	const ids = new Set();
	for (const file of files) {
		if (ids.has(file.id)) {
			throw Error(`Duplicate gen file id: ${file.id}`);
		}
		ids.add(file.id);
	}
};
