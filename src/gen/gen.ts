import * as fp from 'path';

import {
	hasSourceExt,
	toSourceExt,
	basePathToSourceId,
	toBasePath,
} from '../paths.js';

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
	// If true, is generated to the source directory instead of build.
	outputToSource?: boolean;
}

export const toGenResult = (
	originFileId: string,
	rawResult: RawGenResult,
): GenResult => {
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
	const {contents, fileName, outputToSource} = rawGenFile;
	const id = toOutputFileId(originFileId, fileName, outputToSource);
	return {id, contents};
};

// This is a bit of a mess.. but it's a thoroughly tested mess.
const toOutputFileId = (
	originFileId: string,
	rawFileName: string | undefined,
	rawOutputToSource: boolean | undefined,
): string => {
	const outputToSource =
		rawOutputToSource === undefined
			? rawFileName === undefined
				? false
				: hasSourceExt(rawFileName)
			: rawOutputToSource;
	const fileNameWithRawExt =
		rawFileName === undefined
			? toOutputFileName(fp.basename(originFileId))
			: rawFileName;
	const fileName =
		outputToSource && rawFileName === undefined
			? toSourceExt(fileNameWithRawExt)
			: fileNameWithRawExt;
	const dir = fp.dirname(
		outputToSource
			? basePathToSourceId(toBasePath(originFileId))
			: originFileId,
	);
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
		if (i === genPatternIndex) continue;
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
