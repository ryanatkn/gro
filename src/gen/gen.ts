import * as fp from 'path';

import {isSourceId} from '../paths.js';

export const GEN_FILE_SEPARATOR = '.';
export const GEN_FILE_PATTERN_TEXT = 'gen';
export const GEN_FILE_PATTERN =
	GEN_FILE_SEPARATOR + GEN_FILE_PATTERN_TEXT + GEN_FILE_SEPARATOR; // TODO regexp?

export type GenResult = {
	originFileId: string;
	files: GenFile[];
};
export interface GenFile {
	id: string;
	contents: string;
}

export interface GenModule {
	gen: Gen;
}
export interface Gen {
	(g: GenContext): RawGenResult | Promise<RawGenResult>;
}
export interface GenContext {
	// ?
}
// TODO consider other return data - metadata? effects? non-file build artifacts?
export type RawGenResult = string | RawGenFile | RawGenFile[];
export interface RawGenFile {
	contents: string;
	// Defaults to file name without the `.gen`, and can be a relative path.
	// TODO maybe support a transform pattern or callback fn? like '[stem].thing.[ext]'
	fileName?: string;
}

export const toGenResult = (
	originFileId: string,
	rawResult: RawGenResult,
): GenResult => {
	if (!isSourceId(originFileId)) {
		throw Error(`originFileId must be a source id: ${originFileId}`);
	}
	return {
		originFileId,
		files: toGenFiles(originFileId, rawResult),
	};
};

const toGenFiles = (
	originFileId: string,
	rawResult: RawGenResult,
): GenFile[] => {
	if (typeof rawResult === 'string') {
		return [toGenFile(originFileId, {contents: rawResult})];
	} else if (Array.isArray(rawResult)) {
		const files = rawResult.map(f => toGenFile(originFileId, f));
		validateGenFiles(files);
		return files;
	} else {
		return [toGenFile(originFileId, rawResult)];
	}
};

const toGenFile = (originFileId: string, rawGenFile: RawGenFile): GenFile => {
	const {contents, fileName} = rawGenFile;
	const id = toOutputFileId(originFileId, fileName);
	return {id, contents};
};

const toOutputFileId = (
	originFileId: string,
	rawFileName: string | undefined,
): string => {
	if (rawFileName === '') {
		throw Error(`Output file name cannot be an empty string`);
	}
	const fileName = rawFileName || toOutputFileName(fp.basename(originFileId));
	const dir = fp.dirname(originFileId);
	const outputFileId = fp.join(dir, fileName);
	if (outputFileId === originFileId) {
		throw Error('Gen origin and output file ids cannot be the same');
	}
	return outputFileId;
};

const toOutputFileName = (fileName: string): string => {
	const parts = fileName.split(GEN_FILE_SEPARATOR);
	const genPatternIndex = parts.indexOf(GEN_FILE_PATTERN_TEXT);
	if (genPatternIndex === -1) {
		throw Error(
			`Invalid gen file name - '${GEN_FILE_PATTERN_TEXT}' not found in '${fileName}'`,
		);
	}
	if (genPatternIndex !== parts.lastIndexOf(GEN_FILE_PATTERN_TEXT)) {
		throw Error(
			`Invalid gen file name - multiple instances of '${GEN_FILE_PATTERN_TEXT}' found in '${fileName}'`,
		);
	}
	if (genPatternIndex < parts.length - 3) {
		// This check is technically unneccessary,
		// but ensures a consistent file naming convention.
		throw Error(
			`Invalid gen file name - only one additional extension is allowed to follow '${GEN_FILE_PATTERN}' in '${fileName}'`,
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
