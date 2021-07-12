import type {Result} from '@feltcoop/felt/util/types';
import {createHash} from 'crypto';
import {resolve} from 'path';

import type {Build_Config_Input} from 'src/build/build_config.js';
import type {Filesystem} from 'src/fs/filesystem.js';
import {build_id_to_source_id, paths} from '../paths.js';
import {EXTERNALS_SOURCE_ID} from './externals_build_helpers.js';
import type {Build_Dependency} from 'src/build/build_dependency.js';

// Note that this uses md5 and therefore is not cryptographically secure.
// It's fine for now, but some use cases may need security.
export const to_hash = (buf: Buffer): string =>
	createHash('md5').update(buf).digest().toString('hex');

interface Filter_Directory {
	(id: string): boolean;
}

export const create_directory_filter = (dir: string, root_dir = paths.source): Filter_Directory => {
	dir = resolve(root_dir, dir);
	const dir_with_trailing_slash = dir + '/';
	const filter_directory: Filter_Directory = (id) =>
		id === dir || id.startsWith(dir_with_trailing_slash);
	return filter_directory;
};

export interface Map_Dependency_To_Source_Id {
	(dependency: Build_Dependency, build_dir: string): string;
}

// TODO this could be `Map_Build_Id_To_Source_Id` and infer externals from the `base_path`
export const map_dependency_to_source_id: Map_Dependency_To_Source_Id = (dependency, build_dir) => {
	// TODO this is failing with build ids like `terser` - should that be the build id? yes?
	// dependency.external
	if (dependency.external) {
		return EXTERNALS_SOURCE_ID;
	} else {
		return build_id_to_source_id(dependency.build_id, build_dir);
	}
};

export const add_js_sourcemap_footer = (code: string, sourcemapPath: string): string =>
	`${code}\n//# sourceMappingURL=${sourcemapPath}`;

export const add_css_sourcemap_footer = (code: string, sourcemapPath: string): string =>
	`${code}\n/*# sourceMappingURL=${sourcemapPath} */`;

export const validate_input_files = async (
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
