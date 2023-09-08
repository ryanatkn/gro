import type esbuild from 'esbuild';

import type {EcmaScriptTarget} from './helpers.js';

// TODO remove all of this and the related code

export interface EsbuildTransformOptions extends esbuild.TransformOptions {
	target: EcmaScriptTarget;
}

export const to_default_esbuild_options = (
	dev: boolean,
	target: EcmaScriptTarget = 'esnext',
	sourcemap = dev,
): EsbuildTransformOptions => ({
	target,
	sourcemap,
	format: 'esm',
	loader: 'ts',
	charset: 'utf8',
	tsconfigRaw: {compilerOptions: {importsNotUsedAsValues: 'remove'}},
});
