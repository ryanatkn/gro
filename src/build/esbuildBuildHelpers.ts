import * as esbuildPreprocess from 'svelte-preprocess-esbuild';

import {DEFAULT_ECMA_SCRIPT_TARGET, EcmaScriptTarget} from './tsBuildHelpers.js';

export const getDefaultEsbuildPreprocessOptions = (
	target: EcmaScriptTarget = DEFAULT_ECMA_SCRIPT_TARGET,
	sourceMap = true, // sticking with the naming convention of TypeScript and some other libs
): Partial<esbuildPreprocess.Options> => ({
	target,
	sourcemap: sourceMap,
	tsconfigRaw: {compilerOptions: {}}, // pass an empty object so the preprocessor doesn't load the tsconfig
});
