import {Module_Meta, loadModule, Load_Module_Result, find_modules} from '../fs/modules.js';
import {paths} from '../paths.js';
import {get_possible_source_ids} from '../fs/input_path.js';
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
	input_paths: string[] = [paths.source],
	extensions: string[] = [TEST_FILE_SUFFIX],
	root_dirs: string[] = [],
) =>
	find_modules(
		fs,
		input_paths,
		(id) => fs.findFiles(id, (file) => isTestPath(file.path)),
		(input_path) => get_possible_source_ids(input_path, extensions, root_dirs),
	);
