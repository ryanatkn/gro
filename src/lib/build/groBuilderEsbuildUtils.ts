import type esbuild from 'esbuild';

import {DEFAULT_ECMA_SCRIPT_TARGET} from '../build/buildConfigDefaults.js';
import {isThisProjectGro} from '../path/paths.js';
import type {EcmaScriptTarget} from './typescriptUtils.js';

// TODO remove all of this and the related code

export interface EsbuildTransformOptions extends esbuild.TransformOptions {
	target: EcmaScriptTarget;
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
	charset: 'utf8',
	tsconfigRaw: {compilerOptions: {importsNotUsedAsValues: 'remove'}},
	// TODO hacky but trying to get dev build and publishing stuff figured out
	// the more correct way is probably making a `define` option for user configs
	define:
		dev || isThisProjectGro
			? undefined
			: {'process.env.NODE_ENV': dev ? '"development"' : '"production"'},
});

export const toDefaultEsbuildBundleOptions = (
	dev: boolean,
	target: EcmaScriptTarget = DEFAULT_ECMA_SCRIPT_TARGET,
	sourcemap = dev,
): esbuild.BuildOptions => ({
	target,
	sourcemap,
	format: 'esm',
	charset: 'utf8',
	// TODO hacky but trying to get dev build and publishing stuff figured out
	// the more correct way is probably making a `define` option for user configs
	define:
		dev || isThisProjectGro
			? undefined
			: {'process.env.NODE_ENV': dev ? '"development"' : '"production"'},
});
