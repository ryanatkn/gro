import type {Result} from '@feltcoop/felt/utils/types';
import {createHash} from 'crypto';
import {resolve} from 'path';

import type {BuildConfigInput, InputFilter} from '../build/buildConfig.js';
import type {Filesystem} from '../fs/filesystem.js';
import {basePathToSourceId, paths, toBuildBasePath, toSourceExtension} from '../paths.js';
import type {BuildDependency} from './builder.js';
import {EXTERNALS_SOURCE_ID} from './externalsBuildHelpers.js';

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
	const basePath = toBuildBasePath(dependency.buildId, buildDir);
	if (dependency.external) {
		return EXTERNALS_SOURCE_ID;
	} else {
		return basePathToSourceId(toSourceExtension(basePath));
	}
};

export const addJsSourcemapFooter = (code: string, sourcemapPath: string): string =>
	`${code}\n//# sourceMappingURL=${sourcemapPath}`;

export const addCssSourcemapFooter = (code: string, sourcemapPath: string): string =>
	`${code}\n/*# sourceMappingURL=${sourcemapPath} */`;

export interface ResolvedInputFiles {
	files: string[];
	filters: InputFilter[]; // TODO this may be an antipattern, consider removing it
}

export const validateInputFiles = async (
	fs: Filesystem,
	files: string[],
): Promise<Result<{}, {reason: string}>> => {
	const results = await Promise.all(
		files.map(
			async (input): Promise<null | {ok: false; reason: string}> => {
				if (!(await fs.exists(input))) {
					return {ok: false, reason: `Input file does not exist: ${input}`};
				}
				return null;
			},
		),
	);
	for (const result of results) {
		if (result) return result;
	}
	return {ok: true};
};

export const isInputToBuildConfig = (id: string, inputs: readonly BuildConfigInput[]): boolean => {
	for (const input of inputs) {
		if (typeof input === 'string' ? id === input : input(id)) {
			return true;
		}
	}
	return false;
};
