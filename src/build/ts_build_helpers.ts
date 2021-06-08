import {EMPTY_ARRAY} from '@feltcoop/felt/utils/array.js';
import {replace_extension} from '@feltcoop/felt/utils/path.js';
import {spawn_process} from '@feltcoop/felt/utils/process.js';

import type {Filesystem} from '../fs/filesystem.js';
import {
	source_id_to_base_path,
	to_types_build_dir,
	TS_TYPE_EXTENSION as TS_TYPE_EXTENSION,
	TS_TYPEMAP_EXTENSION,
} from '../paths.js';

/*

This uses the TypeScript compiler to generate types.

The function `generateTypes` uses `tsc` to output all declarations to the filesystem,
and then `toGenerateTypesForFile` looks up those cached results.

*/

export type Ecma_Script_Target =
	| 'es3'
	| 'es5'
	| 'es2015'
	| 'es2016'
	| 'es2017'
	| 'es2018'
	| 'es2019'
	| 'es2020'
	| 'esnext';

export const generateTypes = async (
	src: string,
	dest: string,
	sourcemap: boolean,
	typemap: boolean = sourcemap,
	args: string[] = EMPTY_ARRAY,
) => {
	const tscResult = await spawn_process('npx', [
		'tsc',
		'--outDir',
		dest,
		'--root_dir',
		src,
		'--sourceMap',
		sourcemap ? 'true' : 'false',
		'--declarationMap',
		typemap ? 'true' : 'false',
		'--declaration',
		'--emitDeclarationOnly',
		...args,
	]);
	if (!tscResult.ok) {
		throw Error(`TypeScript failed to compile with code ${tscResult.code}`);
	}
};

export interface GenerateTypesForFile {
	(id: string): Promise<GeneratedTypes>;
}

export interface GeneratedTypes {
	types: string;
	typemap?: string;
}

// This looks up types from the filesystem created by `generateTypes` for individual files.
// This lets us do project-wide type compilation once and do cheap lookups from the global cache.
// This strategy is used because the TypeScript compiler performs an order of magnitude slower
// when it compiles type declarations for individual files compared to an entire project at once.
// (there may be dramatic improvements to the individual file building strategy,
// but I couldn't find them in a reasonable amount of time)
export const toGenerateTypesForFile = async (fs: Filesystem): Promise<GenerateTypesForFile> => {
	const results: Map<string, GeneratedTypes> = new Map();
	return async (id) => {
		if (results.has(id)) return results.get(id)!;
		const rootPath = `${to_types_build_dir()}/${source_id_to_base_path(id)}`; // TODO pass through `paths`, maybe from the `Build_Context`
		const typesId = replace_extension(rootPath, TS_TYPE_EXTENSION);
		const typemapId = replace_extension(rootPath, TS_TYPEMAP_EXTENSION);
		const [types, typemap] = await Promise.all([
			fs.read_file(typesId, 'utf8'),
			(async () => ((await fs.exists(typemapId)) ? fs.read_file(typemapId, 'utf8') : undefined))(),
		]);
		const result: GeneratedTypes = {types, typemap};
		results.set(id, result);
		return result;
	};
};
