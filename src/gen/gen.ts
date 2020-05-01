import {join, basename, dirname} from 'path';

import {isSourceId} from '../paths.js';
import {fmtPath} from '../utils/fmt.js';
import {Timings} from '../utils/time.js';
import {ModuleMeta, loadModule, LoadModuleResult} from '../fs/modules.js';
import {red} from '../colors/terminal.js';

// TODO consider splitting the primitive data/helpers/types
// out of this module like how `task` is separated from `runTask`
export const GEN_FILE_SEPARATOR = '.';
export const GEN_FILE_PATTERN_TEXT = 'gen';
export const GEN_FILE_PATTERN =
	GEN_FILE_SEPARATOR + GEN_FILE_PATTERN_TEXT + GEN_FILE_SEPARATOR; // TODO regexp?

export type GenResult = {
	originId: string;
	files: GenFile[];
};
export interface GenFile {
	id: string;
	contents: string;
	originId: string;
}

export interface GenModule {
	gen: Gen;
}
export interface Gen {
	(g: GenContext): RawGenResult | Promise<RawGenResult>;
}
export interface GenContext {
	originId: string;
}
// TODO consider other return data - metadata? effects? non-file build artifacts?
export type RawGenResult = string | RawGenFile | RawGenFile[];
export interface RawGenFile {
	contents: string;
	// Defaults to file name without the `.gen`, and can be a relative path.
	// TODO maybe support a transform pattern or callback fn? like '[stem].thing.[ext]'
	fileName?: string;
}

export interface GenModuleMeta extends ModuleMeta<GenModule> {}

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

export const gen = async (genModules: GenModuleMeta[]): Promise<GenResults> => {
	let inputCount = 0;
	let outputCount = 0;
	const timings = new Timings();
	timings.start('total');
	const results = await Promise.all(
		genModules.map(
			async ({id, mod}): Promise<GenModuleResult> => {
				inputCount++;
				const genCtx: GenContext = {originId: id};
				timings.start(id);
				let rawGenResult;
				try {
					rawGenResult = await mod.gen(genCtx);
				} catch (err) {
					const reason = red(`Error generating ${fmtPath(id)}`);
					return {
						ok: false,
						id,
						error: err,
						reason,
						elapsed: timings.stop(id),
					};
				}
				const {files} = toGenResult(id, rawGenResult);
				outputCount += files.length;
				return {
					ok: true,
					id,
					files,
					elapsed: timings.stop(id),
				};
			},
		),
	);
	return {
		results,
		successes: results.filter(r => r.ok) as GenModuleResultSuccess[],
		failures: results.filter(r => !r.ok) as GenModuleResultFailure[],
		inputCount,
		outputCount,
		elapsed: timings.stop('total'),
	};
};

export const toGenResult = (
	originId: string,
	rawResult: RawGenResult,
): GenResult => {
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
		return [toGenFile(originId, {contents: rawResult})];
	} else if (Array.isArray(rawResult)) {
		const files = rawResult.map(f => toGenFile(originId, f));
		validateGenFiles(files);
		return files;
	} else {
		return [toGenFile(originId, rawResult)];
	}
};

const toGenFile = (originId: string, rawGenFile: RawGenFile): GenFile => {
	const {contents, fileName} = rawGenFile;
	const id = toOutputFileId(originId, fileName);
	return {id, contents, originId};
};

const toOutputFileId = (
	originId: string,
	rawFileName: string | undefined,
): string => {
	if (rawFileName === '') {
		throw Error(`Output file name cannot be an empty string`);
	}
	const fileName = rawFileName || toOutputFileName(basename(originId));
	const dir = dirname(originId);
	const outputFileId = join(dir, fileName);
	if (outputFileId === originId) {
		throw Error('Gen origin and output file ids cannot be the same');
	}
	return outputFileId;
};

export const toOutputFileName = (fileName: string): string => {
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

export const isGenPath = (path: string): boolean =>
	path.includes(GEN_FILE_PATTERN);

const validateGenFiles = (files: GenFile[]) => {
	const ids = new Set();
	for (const file of files) {
		if (ids.has(file.id)) {
			throw Error(`Duplicate gen file id: ${file.id}`);
		}
		ids.add(file.id);
	}
};

export const validateGenModule = (mod: Obj): mod is GenModule =>
	typeof mod.gen === 'function';

export const loadGenModule = (
	id: string,
): Promise<LoadModuleResult<GenModuleMeta>> =>
	loadModule(id, validateGenModule);
