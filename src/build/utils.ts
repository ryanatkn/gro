import {createHash} from 'crypto';
import {resolve} from 'path';
import {replaceExtension, type Result} from '@feltcoop/util';

import type {BuildConfigInput} from './buildConfig.js';
import type {Filesystem} from '../fs/filesystem.js';
import {type Paths, buildIdToSourceId, JS_EXTENSION, paths, TS_EXTENSION} from '../paths.js';
import type {BuildDependency} from './buildDependency.js';

// Note that this uses md5 and therefore is not cryptographically secure.
// It's fine for now, but some use cases may need security.
export const toHash = (buf: Buffer): string =>
	createHash('md5').update(buf).digest().toString('hex');

interface FilterDirectory {
	(id: string): boolean;
}

export const createDirectoryFilter = (dir: string, rootDir = paths.source): FilterDirectory => {
	const resolvedDir = resolve(rootDir, dir);
	const dirWithTrailingSlash = resolvedDir + '/';
	const filterDirectory: FilterDirectory = (id) =>
		id === resolvedDir || id.startsWith(dirWithTrailingSlash);
	return filterDirectory;
};

export interface MapDependencyToSourceId {
	(dependency: BuildDependency, buildDir: string, fs: Filesystem, paths: Paths): Promise<string>;
}

// TODO this was changed from sync to async to support JS:
// https://github.com/feltcoop/gro/pull/270/files
// There's a problem though -- the build system as written wants to resolve source ids up front,
// but in the case of supporting JS we need to defer resolving them to some downstream moment,
// because we can't know if we are talking about a TS or JS file until it's read from disk.
// This is likely going to fit into a larger redesign of the system
// towards a Rollup-compatible API, but this gets basic JS file support working for now.
// The key issues are that 1) this shouldn't be async,
// and 2) JS files may cause errors in rare cases,
// like if the intended source file changes its extension.
// (not a big deal, but points to a system design flaw)
export const mapDependencyToSourceId: MapDependencyToSourceId = async (
	dependency,
	buildDir,
	fs,
	paths,
) => {
	const sourceId = buildIdToSourceId(dependency.buildId, buildDir, paths);
	// TODO hacky -- see comments above
	if ((await fs.exists(sourceId)) || !sourceId.endsWith(TS_EXTENSION)) return sourceId;
	const hackyOtherPossibleSourceId = replaceExtension(sourceId, JS_EXTENSION);
	return (await fs.exists(hackyOtherPossibleSourceId)) ? hackyOtherPossibleSourceId : sourceId;
};

export const addJsSourcemapFooter = (code: string, sourcemapPath: string): string =>
	`${code}\n//# sourceMappingURL=${sourcemapPath}`;

export const addCssSourcemapFooter = (code: string, sourcemapPath: string): string =>
	`${code}\n/*# sourceMappingURL=${sourcemapPath} */`;

export const validateInputFiles = async (
	fs: Filesystem,
	files: string[],
): Promise<Result<object, {reason: string}>> => {
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
