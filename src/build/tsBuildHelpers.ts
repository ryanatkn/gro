import type {Filesystem} from '../fs/filesystem.js';
import {sourceIdToBasePath, toTypesBuildDir, TS_DEFS_EXTENSION} from '../paths.js';
import {EMPTY_ARRAY} from '../utils/array.js';
import {replaceExtension} from '../utils/path.js';
import {spawnProcess} from '../utils/process.js';

/*

This uses the TypeScript compiler to generate types.

The function `generateTypes` uses `tsc` to output all declarations to the filesystem,
and then `toGenerateTypesForFile` looks up those cached results.

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

export const generateTypes = async (
	src: string,
	dest: string,
	sourcemap: boolean,
	declarationMap: boolean = sourcemap,
	args: string[] = EMPTY_ARRAY,
) => {
	const tscResult = await spawnProcess('npx', [
		'tsc',
		'--outDir',
		dest,
		'--rootDir',
		src,
		'--sourceMap',
		sourcemap ? 'true' : 'false',
		'--declarationMap',
		declarationMap ? 'true' : 'false',
		'--declaration',
		'--emitDeclarationOnly',
		...args,
	]);
	if (!tscResult.ok) {
		throw Error(`TypeScript failed to compile with code ${tscResult.code}`);
	}
};

export interface GenerateTypesForFile {
	(id: string): Promise<string>;
}

export const toGenerateTypesForFile = async (fs: Filesystem): Promise<GenerateTypesForFile> => {
	const results: Map<string, string> = new Map();
	return async (id) => {
		if (results.has(id)) return results.get(id)!;
		const typesBasePath = replaceExtension(sourceIdToBasePath(id), TS_DEFS_EXTENSION);
		const typesFilePath = `${toTypesBuildDir()}/${typesBasePath}`; // TODO pass through `paths`, maybe from the `BuildContext`
		const result = await fs.readFile(typesFilePath, 'utf8');
		results.set(id, result);
		return result;
	};
};
