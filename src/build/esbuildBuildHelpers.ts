import esbuild from 'esbuild';
import * as esbuildPreprocess from 'svelte-preprocess-esbuild';

import {DEFAULT_ECMA_SCRIPT_TARGET, EcmaScriptTarget} from './tsBuildHelpers.js';

export const getDefaultEsbuildOptions = (
	target: EcmaScriptTarget = DEFAULT_ECMA_SCRIPT_TARGET,
	sourcemap = true,
): esbuild.TransformOptions => ({
	target,
	sourcemap,
	format: 'esm',
	loader: 'ts',
	tsconfigRaw: {compilerOptions: {importsNotUsedAsValues: 'remove'}},
});

export const getDefaultEsbuildPreprocessOptions = (
	target: EcmaScriptTarget = DEFAULT_ECMA_SCRIPT_TARGET,
	sourcemap = true,
): Partial<esbuildPreprocess.Options> => ({
	target,
	sourcemap,
	tsconfigRaw: {compilerOptions: {}}, // pass an empty object so the preprocessor doesn't load the tsconfig
});
