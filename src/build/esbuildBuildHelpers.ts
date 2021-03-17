import esbuild from 'esbuild';
// TODO switch to `svelte-preprocess-esbuild` when it's updated
import * as sveltePreprocessEsbuild from '../project/svelte-preprocess-esbuild.js';

import {DEFAULT_ECMA_SCRIPT_TARGET, EcmaScriptTarget} from './tsBuildHelpers.js';

export interface EsbuildTransformOptions extends esbuild.TransformOptions {
	target: EcmaScriptTarget;
	sourcemap: boolean;
}

export const getDefaultEsbuildOptions = (
	target: EcmaScriptTarget = DEFAULT_ECMA_SCRIPT_TARGET,
	sourcemap = true,
): EsbuildTransformOptions => ({
	target,
	sourcemap,
	format: 'esm',
	loader: 'ts',
	tsconfigRaw: {compilerOptions: {importsNotUsedAsValues: 'remove'}},
});

export const getDefaultEsbuildPreprocessOptions = (
	target: EcmaScriptTarget = DEFAULT_ECMA_SCRIPT_TARGET,
	sourcemap = true,
): Partial<sveltePreprocessEsbuild.Options> => ({
	target,
	sourcemap,
	tsconfigRaw: {compilerOptions: {}}, // pass an empty object so the preprocessor doesn't load the tsconfig
});
