import {type ModuleMeta, loadModule, type LoadModuleResult, findModules} from '../fs/modules.js';
import {type Gen, type GenResults, type GenFile} from './gen.js';
import {getPossibleSourceIds} from '../fs/inputPath.js';
import {paths} from '../paths.js';
import {type Filesystem} from '../fs/filesystem.js';
import {type SchemaObject} from './genSchemas.js';

// TODO consider splitting the primitive data/helpers/types
// out of this module like how `task` is separated from `runTask`
export const SEPARATOR = '.';

export const GEN_FILE_PATTERN_TEXT = 'gen';
export const GEN_FILE_PATTERN = SEPARATOR + GEN_FILE_PATTERN_TEXT + SEPARATOR;

export const GEN_SCHEMA_FILE_PATTERN_TEXT = 'schema';
export const GEN_SCHEMA_FILE_PATTERN = SEPARATOR + GEN_SCHEMA_FILE_PATTERN_TEXT + SEPARATOR;

export type GenModuleType = 'basic' | 'schema'; // TODO put this on `GenModule` types
export type GenModule = BasicGenModule | SchemaGenModule;
export interface BasicGenModule {
	gen: Gen;
}
export interface SchemaGenModule {
	[key: string]: SchemaObject | unknown;
}

export const toGenModuleType = (filename: string): GenModuleType =>
	filename.includes(GEN_SCHEMA_FILE_PATTERN) ? 'schema' : 'basic';

export const genModuleMeta: Record<GenModuleType, {pattern: string; text: string; sep: string}> = {
	basic: {pattern: GEN_FILE_PATTERN, text: GEN_FILE_PATTERN_TEXT, sep: SEPARATOR},
	schema: {pattern: GEN_SCHEMA_FILE_PATTERN, text: GEN_SCHEMA_FILE_PATTERN_TEXT, sep: SEPARATOR},
};

export const validateGenModule = {
	basic: (mod: Record<string, any>): mod is BasicGenModule => typeof mod?.gen === 'function',
	schema: (mod: Record<string, any>): mod is SchemaGenModule => !!mod,
};

export interface GenModuleMeta extends ModuleMeta<GenModule> {}

export const loadGenModule = (id: string): Promise<LoadModuleResult<GenModuleMeta>> =>
	loadModule(
		id,
		true,
		validateGenModule[toGenModuleType(id)] as any, // TODO why the typecast?
	);

export type CheckGenModuleResult =
	| {
			file: GenFile;
			existingContent: string;
			isNew: false;
			hasChanged: boolean;
	  }
	| {
			file: GenFile;
			existingContent: null;
			isNew: true;
			hasChanged: true;
	  };

export const checkGenModules = async (
	fs: Filesystem,
	genResults: GenResults,
): Promise<CheckGenModuleResult[]> => {
	return Promise.all(
		genResults.successes
			.map((result) => result.files.map((file) => checkGenModule(fs, file)))
			.flat(),
	);
};

export const checkGenModule = async (
	fs: Filesystem,
	file: GenFile,
): Promise<CheckGenModuleResult> => {
	if (!(await fs.exists(file.id))) {
		return {
			file,
			existingContent: null,
			isNew: true,
			hasChanged: true,
		};
	}
	const existingContent = await fs.readFile(file.id, 'utf8');
	return {
		file,
		existingContent,
		isNew: false,
		hasChanged: file.content !== existingContent,
	};
};

export const findGenModules = (
	fs: Filesystem,
	inputPaths: string[] = [paths.source],
	extensions: string[] = [GEN_FILE_PATTERN, GEN_SCHEMA_FILE_PATTERN],
	rootDirs: string[] = [],
) =>
	findModules(
		fs,
		inputPaths,
		(id) => fs.findFiles(id, (file) => extensions.some((e) => file.path.includes(e))),
		(inputPath) => getPossibleSourceIds(inputPath, extensions, rootDirs),
	);
