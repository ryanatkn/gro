import {createHash} from 'crypto';
import type {Result} from '@feltjs/util/result.js';
import {replaceExtension} from '@feltjs/util/path.js';

import type {BuildConfigInput} from './buildConfig.js';
import type {Filesystem} from '../fs/filesystem.js';
import {
	type Paths,
	buildIdToSourceId,
	JS_EXTENSION,
	TS_EXTENSION,
	type SourceId,
} from '../path/paths.js';
import type {BuildDependency} from './buildDependency.js';

// Note that this uses md5 and therefore is not cryptographically secure.
// It's fine for now, but some use cases may need security.
export const toHash = (buf: Buffer): string =>
	createHash('md5').update(buf).digest().toString('hex');

export interface MapDependencyToSourceId {
	(dependency: BuildDependency, buildDir: string, fs: Filesystem, paths: Paths): Promise<SourceId>;
}

// TODO this was changed from sync to async to support JS:
// https://github.com/feltjs/gro/pull/270/files
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

export const isInputToBuildConfig = (id: string, inputs: BuildConfigInput[]): boolean => {
	for (const input of inputs) {
		if (typeof input === 'string' ? id === input : input(id)) {
			return true;
		}
	}
	return false;
};

export type EcmaScriptTarget =
	| 'es3'
	| 'es5'
	| 'es2015'
	| 'es2016'
	| 'es2017'
	| 'es2018'
	| 'es2019'
	| 'es2020'
	| 'esnext';