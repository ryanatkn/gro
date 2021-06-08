import {join, basename, dirname} from 'path';

import type {Filesystem} from '../fs/filesystem.js';
import {is_source_id} from '../paths.js';

// TODO consider splitting the primitive data/helpers/types
// out of this module like how `task` is separated from `run_task`
export const GEN_FILE_SEPARATOR = '.';
export const GEN_FILE_PATTERN_TEXT = 'gen';
export const GEN_FILE_PATTERN = GEN_FILE_SEPARATOR + GEN_FILE_PATTERN_TEXT + GEN_FILE_SEPARATOR; // TODO regexp?

export const isGenPath = (path: string): boolean => path.includes(GEN_FILE_PATTERN);

export type GenResult = {
	origin_id: string;
	files: GenFile[];
};
export interface GenFile {
	id: string;
	contents: string;
	origin_id: string;
}

export interface Gen {
	(g: Gen_Context): RawGenResult | Promise<RawGenResult>;
}
export interface Gen_Context {
	fs: Filesystem;
	origin_id: string;
}
// TODO consider other return data - metadata? effects? non-file build artifacts?
export type RawGenResult = string | RawGenFile | RawGenFile[];
export interface RawGenFile {
	contents: string;
	// Defaults to file name without the `.gen`, and can be a relative path.
	// TODO maybe support a transform pattern or callback fn? like '[stem].thing.[ext]'
	filename?: string;
}

export type Gen_Results = {
	results: Gen_Module_Result[];
	successes: Gen_Module_Result_Success[];
	failures: Gen_Module_Result_Failure[];
	inputCount: number;
	outputCount: number;
	elapsed: number;
};
export type Gen_Module_Result = Gen_Module_Result_Success | Gen_Module_Result_Failure;
export type Gen_Module_Result_Success = {
	ok: true;
	id: string;
	files: GenFile[];
	elapsed: number;
};
export type Gen_Module_Result_Failure = {
	ok: false;
	id: string;
	reason: string;
	error: Error;
	elapsed: number;
};

export const to_gen_result = (origin_id: string, rawResult: RawGenResult): GenResult => {
	if (!is_source_id(origin_id)) {
		throw Error(`origin_id must be a source id: ${origin_id}`);
	}
	return {
		origin_id,
		files: toGenFiles(origin_id, rawResult),
	};
};

const toGenFiles = (origin_id: string, rawResult: RawGenResult): GenFile[] => {
	if (typeof rawResult === 'string') {
		return [toGenFile(origin_id, {contents: rawResult})];
	} else if (Array.isArray(rawResult)) {
		const files = rawResult.map((f) => toGenFile(origin_id, f));
		validateGenFiles(files);
		return files;
	} else {
		return [toGenFile(origin_id, rawResult)];
	}
};

const toGenFile = (origin_id: string, rawGenFile: RawGenFile): GenFile => {
	const {contents, filename} = rawGenFile;
	const id = toOutputFileId(origin_id, filename);
	return {id, contents, origin_id};
};

const toOutputFileId = (origin_id: string, rawFileName: string | undefined): string => {
	if (rawFileName === '') {
		throw Error(`Output file name cannot be an empty string`);
	}
	const filename = rawFileName || toOutputFileName(basename(origin_id));
	const dir = dirname(origin_id);
	const outputFileId = join(dir, filename);
	if (outputFileId === origin_id) {
		throw Error('Gen origin and output file ids cannot be the same');
	}
	return outputFileId;
};

export const toOutputFileName = (filename: string): string => {
	const parts = filename.split(GEN_FILE_SEPARATOR);
	const genPatternIndex = parts.indexOf(GEN_FILE_PATTERN_TEXT);
	if (genPatternIndex === -1) {
		throw Error(`Invalid gen file name - '${GEN_FILE_PATTERN_TEXT}' not found in '${filename}'`);
	}
	if (genPatternIndex !== parts.lastIndexOf(GEN_FILE_PATTERN_TEXT)) {
		throw Error(
			`Invalid gen file name - multiple instances of '${GEN_FILE_PATTERN_TEXT}' found in '${filename}'`,
		);
	}
	if (genPatternIndex < parts.length - 3) {
		// This check is technically unneccessary,
		// but ensures a consistent file naming convention.
		throw Error(
			`Invalid gen file name - only one additional extension is allowed to follow '${GEN_FILE_PATTERN}' in '${filename}'`,
		);
	}
	const finalParts: string[] = [];
	const hasDifferentExt = genPatternIndex === parts.length - 3;
	const length = hasDifferentExt ? parts.length - 1 : parts.length;
	for (let i = 0; i < length; i++) {
		if (i === genPatternIndex) continue; // skip the `.gen.` pattern
		if (i === length - 1 && parts[i] === '') continue; // allow empty extension
		finalParts.push(parts[i]);
	}
	return finalParts.join(GEN_FILE_SEPARATOR);
};

const validateGenFiles = (files: GenFile[]) => {
	const ids = new Set();
	for (const file of files) {
		if (ids.has(file.id)) {
			throw Error(`Duplicate gen file id: ${file.id}`);
		}
		ids.add(file.id);
	}
};
