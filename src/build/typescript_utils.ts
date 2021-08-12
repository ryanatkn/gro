import {EMPTY_ARRAY} from '@feltcoop/felt/util/array.js';
import {replace_extension} from '@feltcoop/felt/util/path.js';
import {spawn} from '@feltcoop/felt/util/process.js';

import type {Filesystem} from 'src/fs/filesystem.js';
import {
	source_id_to_base_path,
	to_types_build_dir,
	TS_TYPE_EXTENSION as TS_TYPE_EXTENSION,
	TS_TYPEMAP_EXTENSION,
} from '../paths.js';

/*

This uses the TypeScript compiler to generate types.

The function `generate_types` uses `tsc` to output all declarations to the filesystem,
and then `to_generate_types_for_file` looks up those cached results.

*/

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

export const generate_types = async (
	src: string,
	dest: string,
	sourcemap: boolean,
	typemap: boolean,
	tsc_args: string[] = EMPTY_ARRAY,
) => {
	const tsc_result = await spawn('npx', [
		'tsc',
		'--outDir',
		dest,
		'--rootDir',
		src,
		'--sourceMap',
		sourcemap ? 'true' : 'false',
		'--declarationMap',
		typemap ? 'true' : 'false',
		'--declaration',
		'--emitDeclarationOnly',
		...tsc_args,
	]);
	if (!tsc_result.ok) {
		throw Error(`TypeScript failed to compile with code ${tsc_result.code}`);
	}
};

export interface GenerateTypesForFile {
	(id: string): Promise<GeneratedTypes>;
}

export interface GeneratedTypes {
	types: string;
	typemap?: string;
}

// This looks up types from the filesystem created by `generate_types` for individual files.
// This lets us do project-wide type compilation once and do cheap lookups from the global cache.
// This strategy is used because the TypeScript compiler performs an order of magnitude slower
// when it compiles type declarations for individual files compared to an entire project at once.
// (there may be dramatic improvements to the individual file building strategy,
// but I couldn't find them in a reasonable amount of time)
export const to_generate_types_for_file = async (fs: Filesystem): Promise<GenerateTypesForFile> => {
	const results: Map<string, GeneratedTypes> = new Map();
	return async (id) => {
		if (results.has(id)) return results.get(id)!;
		const root_path = `${to_types_build_dir()}/${source_id_to_base_path(id)}`; // TODO pass through `paths`, maybe from the `BuildContext`
		const types_id = replace_extension(root_path, TS_TYPE_EXTENSION);
		const typemap_id = replace_extension(root_path, TS_TYPEMAP_EXTENSION);
		const [types, typemap] = await Promise.all([
			fs.read_file(types_id, 'utf8'),
			(async () =>
				(await fs.exists(typemap_id)) ? fs.read_file(typemap_id, 'utf8') : undefined)(),
		]);
		const result: GeneratedTypes = {types, typemap};
		results.set(id, result);
		return result;
	};
};
