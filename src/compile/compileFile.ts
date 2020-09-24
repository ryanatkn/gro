import {extname} from 'path';
import swc from '@swc/core';

import {loadTsconfig} from './tsHelpers.js';
import {
	toSwcCompilerTarget,
	mergeSwcOptions,
	getDefaultSwcOptions,
	addSourceMapFooter,
} from './swcHelpers.js';
import {Logger} from '../utils/log.js';
import {SOURCE_MAP_EXTENSION, SVELTE_EXTENSION, toBuildId, TS_EXTENSION} from '../paths.js';

export interface CompileFile {
	(id: string, contents: string, extension?: string): Promise<CompileResult>;
}
export interface CompileResult {
	// TODO might need to be a union with a type, like `extension: '.svelte'` with additional properties.
	// Svelte compilation properties include `ast`, `warnings`, `vars`, and `stats`
	files: CompiledFile[];
}

// TODO name? so close to `CompileFile` - maybe that should be renamed `FileCompiler`?
export interface CompiledFile {
	id: string;
	contents: string;
	sourceMapOf?: string; // TODO for source maps? hmm. maybe we want a union with an `isSourceMap` boolean flag?
}

// TODO maybe make this optionally synchronous, so not `async` and not using promises when not needeD?
// TODO how should options be handled? and additional file type compilations?
// should `swcOptions` be passed in instead? Required or optional?
// Or is this the friendliest way to do it,
// so consumers can instantiate the `CachingCompiler` without any options?
export const createCompileFile = (log: Logger): CompileFile => {
	// load the TypeScript and swc options
	// TODO somehow parameterize these
	const tsconfigPath = undefined;
	const basePath = undefined;
	const tsconfig = loadTsconfig(log, tsconfigPath, basePath);
	const target = toSwcCompilerTarget(tsconfig.compilerOptions?.target);
	const sourceMap = tsconfig.compilerOptions?.sourceMap ?? process.env.NODE_ENV === 'development';
	const swcOptions = getDefaultSwcOptions(target, sourceMap);

	const compileFile: CompileFile = async (
		id: string,
		contents: string,
		extension = extname(id),
	): Promise<CompileResult> => {
		switch (extension) {
			case TS_EXTENSION: {
				const finalSwcOptions = mergeSwcOptions(swcOptions, id);
				const output = await swc.transform(contents, finalSwcOptions);
				const buildId = toBuildId(id);
				const sourceMapBuildId = buildId + SOURCE_MAP_EXTENSION;
				const files: CompiledFile[] = [
					{
						id: buildId,
						contents: output.map ? addSourceMapFooter(output.code, sourceMapBuildId) : output.code,
					},
				];
				if (output.map) {
					files.push({
						id: sourceMapBuildId,
						contents: output.map,
						sourceMapOf: buildId,
					});
				}
				return {files};
			}
			// TODO Svelte, see `src/build/rollup-plugin-gro-svelte.ts`
			// Need to rework the caching compiler API to handle multiple output files.
			// We should also unify this API with `GenFile` and the rest.
			case SVELTE_EXTENSION:
			default: {
				return {files: [{id, contents}]};
			}
		}
	};
	return compileFile;
};
