import {createHash} from 'crypto';
import type {Result} from '@feltjs/util/result.js';
import fs from 'fs-extra';

import type {BuildConfigInput} from './build_config.js';
import {
	type Paths,
	build_id_to_source_id,
	JS_EXTENSION,
	TS_EXTENSION,
	type SourceId,
	replace_extension,
} from '../path/paths.js';
import type {BuildDependency} from './build_dependency.js';

// Note that this uses md5 and therefore is not cryptographically secure.
// It's fine for now, but some use cases may need security.
export const to_hash = (buf: Buffer): string =>
	createHash('md5').update(buf).digest().toString('hex');

export interface MapDependencyToSourceId {
	(dependency: BuildDependency, build_dir: string, paths: Paths): Promise<SourceId>;
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
export const map_dependency_to_source_d: MapDependencyToSourceId = async (
	dependency,
	build_dir,
	paths,
) => {
	const source_id = build_id_to_source_id(dependency.build_id, build_dir, paths);
	// TODO hacky -- see comments above
	if ((await fs.exists(source_id)) || !source_id.endsWith(TS_EXTENSION)) return source_id;
	const hacky_other_possible_source_id = replace_extension(source_id, JS_EXTENSION);
	return (await fs.exists(hacky_other_possible_source_id))
		? hacky_other_possible_source_id
		: source_id;
};

export const add_js_sourcemap_footer = (code: string, sourcemapPath: string): string =>
	`${code}\n//# sourceMappingURL=${sourcemapPath}`;

export const validate_input_files = async (
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

export const is_input_to_build_config = (id: string, inputs: BuildConfigInput[]): boolean => {
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
