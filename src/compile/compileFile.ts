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
import {SVELTE_EXTENSION, toSourceMapPath, TS_EXTENSION} from '../paths.js';

export interface CompileFile {
	(id: string, contents: string): Promise<CompiledOutput>;
}
export interface CompiledOutput {
	code: string;
	map?: string;
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
	): Promise<CompiledOutput> => {
		switch (extname(id)) {
			case TS_EXTENSION: {
				const finalSwcOptions = mergeSwcOptions(swcOptions, id);
				const output = await swc.transform(contents, finalSwcOptions);

				if (output.map) {
					output.code = addSourceMapFooter(output.code, toSourceMapPath(id));
				}
				return output;
			}
			// TODO Svelte, see `src/build/rollup-plugin-gro-svelte.ts`
			// Need to rework the caching compiler API to handle multiple output files.
			// We should also unify this API with `GenFile` and the rest.
			case SVELTE_EXTENSION:
			default: {
				return {code: contents};
			}
		}
	};
	return compileFile;
};
