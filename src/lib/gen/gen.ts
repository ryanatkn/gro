import type {Logger} from '@feltjs/util/log.js';
import {join, basename, dirname} from 'node:path';
import {z} from 'zod';

import type {Filesystem} from '../fs/filesystem.js';
import {isSourceId} from '../path/paths.js';
import {genModuleMeta, toGenModuleType} from './genModule.js';

export type GenResult = {
	originId: string;
	files: GenFile[];
};
export interface GenFile {
	id: string;
	content: string;
	originId: string;
	format: boolean;
}

export interface Gen {
	(ctx: GenContext): RawGenResult | Promise<RawGenResult>;
}
export interface GenContext {
	fs: Filesystem;
	originId: string;
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
	if (rawResult === null) {
		return [];
	} else if (typeof rawResult === 'string') {
		return [toGenFile(originId, {content: rawResult})];
	} else if (Array.isArray(rawResult)) {
		const files = rawResult.flatMap((f) => toGenFiles(originId, f));
		validateGenFiles(files);
		return files;
	}
	return [toGenFile(originId, rawResult)];
};

const toGenFile = (originId: string, rawGenFile: RawGenFile): GenFile => {
	const {content, filename, format = true} = rawGenFile;
	const id = toOutputFileId(originId, filename);
	return {id, content, originId, format};
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
	const {pattern, text, sep} = genModuleMeta[toGenModuleType(filename)];
	const parts = filename.split(sep);
	const genPatternIndex = parts.indexOf(text);
	if (genPatternIndex === -1) {
		throw Error(`Invalid gen file name - '${text}' not found in '${filename}'`);
	}
	if (genPatternIndex !== parts.lastIndexOf(text)) {
		throw Error(`Invalid gen file name - multiple instances of '${text}' found in '${filename}'`);
	}
	if (genPatternIndex < parts.length - 3) {
		// This check is technically unneccessary,
		// but ensures a consistent file naming convention.
		throw Error(
			`Invalid gen file name - only one additional extension is allowed to follow '${pattern}' in '${filename}'`,
		);
	}
	const finalParts: string[] = [];
	const hasDifferentExt = genPatternIndex === parts.length - 3;
	const length = hasDifferentExt ? parts.length - 1 : parts.length;
	for (let i = 0; i < length; i++) {
		if (i === genPatternIndex) continue; // skip the `.gen.` or `.schema.` pattern
		if (i === length - 1 && parts[i] === '') continue; // allow empty extension
		finalParts.push(parts[i]);
	}
	return finalParts.join(sep);
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