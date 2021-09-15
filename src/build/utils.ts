import type {Result} from '@feltcoop/felt/util/types';
import {createHash} from 'crypto';
import {resolve} from 'path';
import {replaceExtension} from '@feltcoop/felt/util/path.js';

import type {BuildConfigInput} from 'src/build/buildConfig.js';
import type {Filesystem} from 'src/fs/filesystem.js';
import {buildIdToSourceId, JS_EXTENSION, paths} from '../paths.js';
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
	(dependency: BuildDependency, buildDir: string, fs: Filesystem): Promise<string>;
}

// TODO this could be `MapBuildIdToSourceId` and infer externals from the `basePath`
export const mapDependencyToSourceId: MapDependencyToSourceId = async (
	dependency,
	buildDir,
	fs,
) => {
	// TODO this is failing with build ids like `terser` - should that be the build id? yes?
	// dependency.external
	if (dependency.external) {
		return EXTERNALS_SOURCE_ID;
	} else {
		const sourceId = buildIdToSourceId(dependency.buildId, buildDir);
		if (await fs.exists(sourceId)) return sourceId;
		// TODO !! hacky to see it working -- we probably want to resolve upstream,
		// but what about the case where no file exists at all, and then later a `.js` file is added?
		const otherPossibleSourceId = replaceExtension(sourceId, JS_EXTENSION);
		return (await fs.exists(otherPossibleSourceId)) ? otherPossibleSourceId : sourceId;
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

export const isInputToBuildConfig = (id: string, inputs: readonly BuildConfigInput[]): boolean => {
	for (const input of inputs) {
		if (typeof input === 'string' ? id === input : input(id)) {
			return true;
		}
	}
	return false;
};
