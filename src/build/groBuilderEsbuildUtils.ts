import type esbuild from 'esbuild';
import type * as sveltePreprocessEsbuild from 'svelte-preprocess-esbuild';

import {DEFAULT_ECMA_SCRIPT_TARGET} from '../build/buildConfigDefaults.js';
import {isThisProjectGro} from '../paths.js';
import {type EcmaScriptTarget} from './typescriptUtils.js';

export interface EsbuildTransformOptions extends esbuild.TransformOptions {
	target: EcmaScriptTarget;
	sourcemap: boolean;
}

export const toDefaultEsbuildOptions = (
	dev: boolean,
	target: EcmaScriptTarget = DEFAULT_ECMA_SCRIPT_TARGET,
	sourcemap = dev,
): EsbuildTransformOptions => ({
	target,
	sourcemap,
	format: 'esm',
	loader: 'ts',
	charset: 'utf8', // following `svelte-preprocess-esbuild` here
	tsconfigRaw: {compilerOptions: {importsNotUsedAsValues: 'remove'}},
	// TODO hacky but trying to get dev build and publishing stuff figured out
	// the more correct way is probably making a `define` option for user configs
	define:
		dev || isThisProjectGro
			? undefined
			: {'process.env.NODE_ENV': dev ? '"development"' : '"production"'},
});

export const toDefaultEsbuildPreprocessOptions = (
	dev: boolean,
	target: EcmaScriptTarget = DEFAULT_ECMA_SCRIPT_TARGET,
	sourcemap = dev,
): Partial<sveltePreprocessEsbuild.Options> => ({
	target,
	sourcemap,
	tsconfigRaw: {compilerOptions: {}}, // pass an empty object so the preprocessor doesn't load the tsconfig
	// TODO hacky but trying to get dev build and publishing stuff figured out
	// the more correct way is probably making a `define` option for user configs
	define:
		dev || isThisProjectGro
			? undefined
			: {'process.env.NODE_ENV': dev ? '"development"' : '"production"'},
});
