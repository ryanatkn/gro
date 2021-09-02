import type {Result} from '@feltcoop/felt/util/types';
import {createHash} from 'crypto';
import {resolve} from 'path';

import type {BuildConfigInput} from 'src/build/buildConfig.js';
import type {Filesystem} from 'src/fs/filesystem.js';
import {buildIdToSourceId, paths} from '../paths.js';
import {EXTERNALS_SOURCE_ID} from './groBuilderExternalsUtils.js';
import type {BuildDependency} from 'src/build/buildDependency.js';

// Note that this uses md5 and therefore is not cryptographically secure.
// It's fine for now, but some use cases may need security.
export const toHash = (buf: Buffer): string =>
	createHash('md5').update(buf).digest().toString('hex');

interface FilterDirectory {
	(id: string): boolean;
}

export const createDirectoryFilter = (dir: string, rootDir = paths.source): FilterDirectory => {
	dir = resolve(rootDir, dir);
	const dirWithTrailingSlash = dir + '/';
	const filterDirectory: FilterDirectory = (id) =>
		id === dir || id.startsWith(dirWithTrailingSlash);
	return filterDirectory;
};

export interface MapDependencyToSourceId {
	(dependency: BuildDependency, buildDir: string): string;
}

// TODO this could be `MapBuildIdToSourceId` and infer externals from the `basePath`
export const mapDependencyToSourceId: MapDependencyToSourceId = (dependency, buildDir) => {
	// TODO this is failing with build ids like `terser` - should that be the build id? yes?
	// dependency.external
	if (dependency.external) {
		return EXTERNALS_SOURCE_ID;
	} else {
		return buildIdToSourceId(dependency.buildId, buildDir);
	}
};

export const addJsSourcemapFooter = (code: string, sourcemapPath: string): string =>
	`${code}\n//# sourceMappingURL=${sourcemapPath}`;

export const addCssSourcemapFooter = (code: string, sourcemapPath: string): string =>
	`${code}\n/*# sourceMappingURL=${sourcemapPath} */`;

export const validateInputFiles = async (
	fs: Filesystem,
	files: string[],
): Promise<Result<{}, {reason: string}>> => {
	const results = await Promise.all(
		files.map(async (input): Promise<null | {ok: false; reason: string}> => {
			if (!(await fs.exists(input))) {
				return {ok: false, reason: `Input file does not exist: ${input}`};
			}
			return null;
		}),
	);
	for (const result of results) {
		if (result) return result;
	}
	return {ok: true};
};

export const isInputToBuildConfig = (
	id: string,
	inputs: readonly BuildConfigInput[],
): boolean => {
	for (const input of inputs) {
		if (typeof input === 'string' ? id === input : input(id)) {
			return true;
		}
	}
	return false;
};
