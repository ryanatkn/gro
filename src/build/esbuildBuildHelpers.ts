import type esbuild from 'esbuild';
import type * as sveltePreprocessEsbuild from 'svelte-preprocess-esbuild';

import {DEFAULT_ECMA_SCRIPT_TARGET, EcmaScriptTarget} from './tsBuildHelpers.js';

export interface EsbuildTransformOptions extends esbuild.TransformOptions {
	target: EcmaScriptTarget;
	sourcemap: boolean;
}

export const getDefaultEsbuildOptions = (
	target: EcmaScriptTarget = DEFAULT_ECMA_SCRIPT_TARGET,
	sourcemap = true,
	dev = true,
): EsbuildTransformOptions => ({
	target,
	sourcemap,
	format: 'esm',
	loader: 'ts',
	charset: 'utf8', // following `svelte-preprocess-esbuild` here
	tsconfigRaw: {compilerOptions: {importsNotUsedAsValues: 'remove'}},
	define: {
		'import.meta.env.DEV': JSON.stringify(dev),
		// 'import.meta.env.SSR': 'false', // TODO (when implemented, also add to bootstrap npm script)
	},
});

export const getDefaultEsbuildPreprocessOptions = (
	target: EcmaScriptTarget = DEFAULT_ECMA_SCRIPT_TARGET,
	sourcemap = true,
	dev = true,
): Partial<sveltePreprocessEsbuild.Options> => ({
	target,
	sourcemap,
	tsconfigRaw: {compilerOptions: {}}, // pass an empty object so the preprocessor doesn't load the tsconfig
	define: {
		'import.meta.env.DEV': JSON.stringify(dev),
		// 'import.meta.env.SSR': 'false', // TODO (when implemented, also add to bootstrap npm script)
	},
});
