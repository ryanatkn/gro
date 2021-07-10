import type esbuild from 'esbuild';
import type * as svelte_preprocess_esbuild from 'svelte-preprocess-esbuild';

import {DEFAULT_ECMA_SCRIPT_TARGET} from '../build/default_build_config.js';
import {is_this_project_gro} from '../paths.js';
import type {Ecma_Script_Target} from './ts_build_helpers.js';

export interface Esbuild_Transform_Options extends esbuild.TransformOptions {
	target: Ecma_Script_Target;
	sourcemap: boolean;
}

export const to_default_esbuild_options = (
	dev: boolean,
	target: Ecma_Script_Target = DEFAULT_ECMA_SCRIPT_TARGET,
	sourcemap = dev,
): Esbuild_Transform_Options => ({
	target,
	sourcemap,
	format: 'esm',
	loader: 'ts',
	charset: 'utf8', // following `svelte-preprocess-esbuild` here
	tsconfigRaw: {compilerOptions: {importsNotUsedAsValues: 'remove'}},
	// TODO hacky but trying to get dev build and publishing stuff figured out
	// the more correct way is probably making a `define` option for user configs
	define:
		dev || is_this_project_gro
			? undefined
			: {'process.env.NODE_ENV': dev ? '"development"' : '"production"'},
});

export const to_default_esbuild_preprocess_options = (
	dev: boolean,
	target: Ecma_Script_Target = DEFAULT_ECMA_SCRIPT_TARGET,
	sourcemap = dev,
): Partial<svelte_preprocess_esbuild.Options> => ({
	target,
	sourcemap,
	tsconfigRaw: {compilerOptions: {}}, // pass an empty object so the preprocessor doesn't load the tsconfig
	// TODO hacky but trying to get dev build and publishing stuff figured out
	// the more correct way is probably making a `define` option for user configs
	define:
		dev || is_this_project_gro
			? undefined
			: {'process.env.NODE_ENV': dev ? '"development"' : '"production"'},
});
