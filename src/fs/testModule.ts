import {Module_Meta, loadModule, Load_Module_Result, findModules} from '../fs/modules.js';
import {paths} from '../paths.js';
import {getPossibleSourceIds} from '../fs/inputPath.js';
import type {Filesystem} from './filesystem.js';

// TODO this is no longer needed to the same extent as it was before switching to `uvu`,
// but it contains the conventions for the app used in some other places

export interface TestModule_Meta extends Module_Meta<TestModule> {}

export type TestModule = object;

export const validateTestModule = (mod: Record<string, any>): mod is TestModule =>
	!!mod && typeof mod === 'object';

export const TEST_FILE_SUFFIX = '.test.ts';

export const isTestPath = (path: string): boolean => path.endsWith(TEST_FILE_SUFFIX);

export const loadTestModule = (id: string): Promise<Load_Module_Result<TestModule_Meta>> =>
	loadModule(id, validateTestModule);

export const findTestModules = (
	fs: Filesystem,
	inputPaths: string[] = [paths.source],
	extensions: string[] = [TEST_FILE_SUFFIX],
	root_dirs: string[] = [],
) =>
	findModules(
		fs,
		inputPaths,
		(id) => fs.findFiles(id, (file) => isTestPath(file.path)),
		(inputPath) => getPossibleSourceIds(inputPath, extensions, root_dirs),
	);
