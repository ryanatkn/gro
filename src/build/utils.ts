import type {Result} from '@feltcoop/felt/util/types';
import {createHash} from 'crypto';
import {resolve} from 'path';

import type {Build_Config_Input, Input_Filter} from '../build/build_config.js';
import type {Filesystem} from '../fs/filesystem.js';
import {base_path_to_source_id, paths, to_build_base_path, to_source_extension} from '../paths.js';
import type {Build_Dependency} from './builder.js';
import {EXTERNALS_SOURCE_ID} from './externals_build_helpers.js';

// Note that this uses md5 and therefore is not cryptographically secure.
// It's fine for now, but some use cases may need security.
export const to_hash = (buf: Buffer): string =>
	createHash('md5').update(buf).digest().toString('hex');

interface FilterDirectory {
	(id: string): boolean;
}

export const createDirectoryFilter = (dir: string, root_dir = paths.source): FilterDirectory => {
	dir = resolve(root_dir, dir);
	const dirWithTrailingSlash = dir + '/';
	const filterDirectory: FilterDirectory = (id) =>
		id === dir || id.startsWith(dirWithTrailingSlash);
	return filterDirectory;
};

export interface Map_Dependency_To_Source_Id {
	(dependency: Build_Dependency, build_dir: string): string;
}

// TODO this could be `Map_Build_Id_To_Source_Id` and infer externals from the `base_path`
export const map_dependency_to_source_id: Map_Dependency_To_Source_Id = (dependency, build_dir) => {
	// TODO this is failing with build ids like `terser` - should that be the build id? yes?
	// dependency.external
	const base_path = to_build_base_path(dependency.build_id, build_dir);
	if (dependency.external) {
		return EXTERNALS_SOURCE_ID;
	} else {
		return base_path_to_source_id(to_source_extension(base_path));
	}
};

export const add_js_sourcemap_footer = (code: string, sourcemapPath: string): string =>
	`${code}\n//# sourceMappingURL=${sourcemapPath}`;

export const add_css_sourcemap_footer = (code: string, sourcemapPath: string): string =>
	`${code}\n/*# sourceMappingURL=${sourcemapPath} */`;

export interface ResolvedInputFiles {
	files: string[];
	filters: Input_Filter[]; // TODO this may be an antipattern, consider removing it
}

export const validate_input_files = async (
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

export const is_input_to_build_config = (
	id: string,
	inputs: readonly Build_Config_Input[],
): boolean => {
	for (const input of inputs) {
		if (typeof input === 'string' ? id === input : input(id)) {
			return true;
		}
	}
	return false;
};
