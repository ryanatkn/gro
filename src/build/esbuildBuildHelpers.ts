import type esbuild from 'esbuild';
import type * as sveltePreprocessEsbuild from 'svelte-preprocess-esbuild';

import {DEFAULT_ECMA_SCRIPT_TARGET} from '../build/defaultBuildConfig.js';
import type {EcmaScriptTarget} from './tsBuildHelpers.js';

export interface EsbuildTransformOptions extends esbuild.TransformOptions {
	target: EcmaScriptTarget;
	sourcemap: boolean;
}

export const getDefaultEsbuildOptions = (
	target: EcmaScriptTarget = DEFAULT_ECMA_SCRIPT_TARGET,
	dev = process.env.NODE_ENV !== 'production',
	sourcemap = dev,
): EsbuildTransformOptions => ({
	target,
	sourcemap,
	format: 'esm',
	loader: 'ts',
	charset: 'utf8', // following `svelte-preprocess-esbuild` here
	tsconfigRaw: {compilerOptions: {importsNotUsedAsValues: 'remove'}},
	// TODO hacky but trying to get dev build and publishing stuff figured out
	define: dev ? undefined : {'process.env.NODE_ENV': dev ? '"development"' : '"production"'},
});

export const getDefaultEsbuildPreprocessOptions = (
	target: EcmaScriptTarget = DEFAULT_ECMA_SCRIPT_TARGET,
	dev = process.env.NODE_ENV !== 'production',
	sourcemap = dev,
): Partial<sveltePreprocessEsbuild.Options> => ({
	target,
	sourcemap,
	tsconfigRaw: {compilerOptions: {}}, // pass an empty object so the preprocessor doesn't load the tsconfig
	// TODO hacky but trying to get dev build and publishing stuff figured out
	define: dev ? undefined : {'process.env.NODE_ENV': dev ? '"development"' : '"production"'},
});
