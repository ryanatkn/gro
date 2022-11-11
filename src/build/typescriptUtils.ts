import {type Logger, spawn, replaceExtension} from '@feltcoop/util';

import type {Filesystem} from '../fs/filesystem.js';
import {
	sourceIdToBasePath,
	toTypesBuildDir,
	TS_TYPE_EXTENSION,
	TS_TYPEMAP_EXTENSION,
} from '../paths.js';
import {printCommandArgs, serializeArgs, toForwardedArgs} from '../utils/args.js';

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
	typemap: boolean,
	log: Logger,
): Promise<void> => {
	const forwardedArgs = {
		...toForwardedArgs('tsc'),
		outDir: dest,
		rootDir: src,
		sourceMap: sourcemap,
		declarationMap: typemap,
		declaration: true,
		emitDeclarationOnly: true,
		skipLibCheck: true,
	};
	const serializedArgs = ['tsc', ...serializeArgs(forwardedArgs)];
	log.info(printCommandArgs(serializedArgs));
	const tscResult = await spawn('npx', serializedArgs);
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
		const rootPath = `${toTypesBuildDir()}/${sourceIdToBasePath(id)}`; // TODO pass through `paths`, maybe from the `BuildContext`
		const typesId = replaceExtension(rootPath, TS_TYPE_EXTENSION);
		const typemapId = replaceExtension(rootPath, TS_TYPEMAP_EXTENSION);
		const [types, typemap] = await Promise.all([
			fs.readFile(typesId, 'utf8'),
			(async () => ((await fs.exists(typemapId)) ? fs.readFile(typemapId, 'utf8') : undefined))(),
		]);
		const result: GeneratedTypes = {types, typemap};
		results.set(id, result);
		return result;
	};
};
