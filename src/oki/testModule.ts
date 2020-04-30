import {ModuleMeta, loadModule, LoadModuleResult} from '../files/modules.js';

export interface TestModuleMeta extends ModuleMeta<TestModule> {}

export type TestModule = object;

export const validateTestModule = (mod: Obj): mod is TestModule =>
	!!mod && typeof mod === 'object';

export const TEST_FILE_SUFFIX = '.test.ts';

export const isTestPath = (path: string): boolean =>
	path.endsWith(TEST_FILE_SUFFIX);

export const loadTestModule = (
	id: string,
): Promise<LoadModuleResult<TestModuleMeta>> =>
	loadModule(id, validateTestModule);

export const TEST_BUILD_FILE_MATCHER = /.+\.test\.js$/;
export const isTestBuildFile = (path: string): boolean =>
	TEST_BUILD_FILE_MATCHER.test(path);

// Artifacts include typings and sourcemaps.
export const TEST_BUILD_ARTIFACT_MATCHER = /.+\.test\.(js\.map|d\.ts|d\.ts\.map)$/;
export const isTestBuildArtifact = (path: string): boolean =>
	TEST_BUILD_ARTIFACT_MATCHER.test(path);
