import {join, basename, dirname} from 'path';

import {isSourceId, toBasePath} from '../paths.js';
import {LogLevel, logger} from '../utils/log.js';
import {omitUndefined} from '../utils/object.js';
import {magenta, yellow, red} from '../colors/terminal.js';
import {fmtPath} from '../utils/fmt.js';

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

export interface GenModuleMeta {
	id: string;
	mod: GenModule;
}

export interface GenHost {
	findGenModules: (dir: string) => Promise<string[]>; // returns source ids
	loadGenModule: (sourceId: string) => Promise<GenModuleMeta>;
	// `outputFile` has the same interface as `fs.writeFile`,
	// but for now it's text-only and assumes utf8.
	// TODO add support for typed arrays and buffers
	outputFile: (file: GenFile) => Promise<void>;
}

export interface Options {
	logLevel: LogLevel;
	host: GenHost;
	dir: string;
}
export type RequiredOptions = 'host' | 'dir';
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => ({
	logLevel: LogLevel.Info,
	...omitUndefined(opts),
});

// TODO test this
export const gen = async (opts: InitialOptions): Promise<void> => {
	const {logLevel, host, dir} = initOptions(opts);
	const log = logger(logLevel, [magenta('[gen]')]);
	const {info, error} = log;

	// TODO is this right? or should we convert input paths to source ids?
	if (!isSourceId(dir)) {
		throw Error(`dir must be a source id: ${dir}`);
	}

	const genSourceIds = await host.findGenModules(dir);
	const genModules = (
		await Promise.all(
			genSourceIds.map(async sourceId => {
				try {
					const genModule = await host.loadGenModule(sourceId);
					if (!validateGenModule(genModule.mod)) {
						throw Error(`Gen module is invalid: ${toBasePath(sourceId)}`);
					}
					return genModule;
				} catch (err) {
					const reason = `Failed to load gen ${fmtPath(sourceId)}.`;
					error(red(reason), yellow(err.message));
					return null!; // `!` fills in for `.filter(Boolean)`
				}
			}),
		)
	).filter(Boolean);

	// TODO how should this work? do we want a single mutable state property?
	// the first use case is probably going to be including the origin file id, whic

	for (const {id, mod} of genModules) {
		const genCtx: GenContext = {originId: id};
		const rawGenResult = await mod.gen(genCtx);
		const {files} = toGenResult(id, rawGenResult);
		await Promise.all(files.map(file => host.outputFile(file)));
	}

	info('gen!');
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
