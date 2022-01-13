import {type Logger} from '@feltcoop/felt/util/log';
import {join, basename, dirname} from 'path';

import {type Filesystem} from 'src/fs/filesystem.js';
import {isSourceId} from '../paths.js';

// TODO consider splitting the primitive data/helpers/types
// out of this module like how `task` is separated from `runTask`
export const GEN_FILE_SEPARATOR = '.';
export const GEN_FILE_PATTERN_TEXT = 'gen';
export const GEN_FILE_PATTERN = GEN_FILE_SEPARATOR + GEN_FILE_PATTERN_TEXT + GEN_FILE_SEPARATOR; // TODO regexp?

export const isGenPath = (path: string): boolean => path.includes(GEN_FILE_PATTERN);

export type GenResult = {
	originId: string;
	files: GenFile[];
};
export interface GenFile {
	id: string;
	content: string;
	originId: string;
}

export interface Gen {
	(ctx: GenContext): RawGenResult | Promise<RawGenResult>;
}
export interface GenContext {
	fs: Filesystem;
	originId: string;
	log: Logger;
}
// TODO consider other return data - metadata? effects? non-file build artifacts?
export type RawGenResult = string | RawGenFile | RawGenFile[];
export interface RawGenFile {
	content: string;
	// Defaults to file name without the `.gen`, and can be a relative path.
	// TODO maybe support a transform pattern or callback fn? like '[stem].thing.[ext]'
	filename?: string;
}

export type GenResults = {
	results: GenModuleResult[];
	successes: GenModuleResultSuccess[];
	failures: GenModuleResultFailure[];
	inputCount: number;
	outputCount: number;
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

export const toGenResult = (originId: string, rawResult: RawGenResult): GenResult => {
	if (!isSourceId(originId)) {
		throw Error(`originId must be a source id: ${originId}`);
	}
	return {
		originId,
		files: toGenFiles(originId, rawResult),
	};
};

const toGenFiles = (originId: string, rawResult: RawGenResult): GenFile[] => {
	if (typeof rawResult === 'string') {
		return [toGenFile(originId, {content: rawResult})];
	} else if (Array.isArray(rawResult)) {
		const files = rawResult.map((f) => toGenFile(originId, f));
		validateGenFiles(files);
		return files;
	} else {
		return [toGenFile(originId, rawResult)];
	}
};

const toGenFile = (originId: string, rawGenFile: RawGenFile): GenFile => {
	const {content, filename} = rawGenFile;
	const id = toOutputFileId(originId, filename);
	return {id, content, originId};
};

const toOutputFileId = (originId: string, rawFileName: string | undefined): string => {
	if (rawFileName === '') {
		throw Error(`Output file name cannot be an empty string`);
	}
	const filename = rawFileName || toOutputFileName(basename(originId));
	const dir = dirname(originId);
	const outputFileId = join(dir, filename);
	if (outputFileId === originId) {
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
