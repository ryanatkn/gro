import type esbuild from 'esbuild';

import {DEFAULT_ECMA_SCRIPT_TARGET} from './build_config_defaults.js';
import type {EcmaScriptTarget} from './helpers.js';

// TODO remove all of this and the related code

export interface EsbuildTransformOptions extends esbuild.TransformOptions {
	target: EcmaScriptTarget;
}

export const to_default_esbuild_options = (
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
});
