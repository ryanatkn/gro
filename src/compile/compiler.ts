import {extname} from 'path';
import swc from '@swc/core';
import svelte from 'svelte/compiler.js';
import {PreprocessorGroup} from 'svelte/types/compiler/preprocess';
import {CompileOptions} from 'svelte/types/compiler/interfaces';

import {loadTsconfig, TsConfig} from './tsHelpers.js';
import {
	toSwcCompilerTarget,
	mergeSwcOptions,
	getDefaultSwcOptions,
	addSourceMapFooter,
} from './swcHelpers.js';
import {
	baseSvelteCompileOptions,
	handleStats,
	handleWarn,
	SvelteCompilation,
} from './svelteHelpers.js';
import {Logger} from '../utils/log.js';
import {
	CSS_EXTENSION,
	JS_EXTENSION,
	SOURCE_MAP_EXTENSION,
	SVELTE_EXTENSION,
	toBuildId,
	TS_EXTENSION,
} from '../paths.js';
import {sveltePreprocessSwc} from '../project/svelte-preprocess-swc.js';
import {replaceExtension} from '../utils/path.js';
import {omitUndefined} from '../utils/object.js';
import {inferEncoding} from '../fs/encoding.js';
import {UnreachableError} from '../utils/error.js';

export interface Compiler {
	// TODO maybe make `compile` optionally synchronous, depending on the kind of file? (Svelte is sync, swc allows async or sync)
	compile(id: string, contents: string | Buffer, extension?: string): Promise<CompileResult>;
}

export interface CompileResult {
	compilations: Compilation[];
}

export type Compilation = TextCompilation | BinaryCompilation;
export interface BaseCompilation {
	id: string;
	extension: string;
}
// TODO might need to be a union with a type, like `extension: '.svelte'` with additional properties.
// Svelte compilation properties include `ast`, `warnings`, `vars`, and `stats`
export interface TextCompilation extends BaseCompilation {
	encoding: 'utf8';
	contents: string;
	sourceMapOf: string | null; // TODO for source maps? hmm. maybe we want a union with an `isSourceMap` boolean flag?
}
export interface BinaryCompilation extends BaseCompilation {
	encoding: null;
	contents: Buffer;
}

export interface Options {
	dev: boolean;
	log: Logger;
	sourceMap: boolean;
	tsconfig: TsConfig;
	swcOptions: swc.Options;
	svelteCompileOptions: CompileOptions;
	sveltePreprocessor: PreprocessorGroup | PreprocessorGroup[] | null;
	onwarn: typeof handleWarn; // TODO currently just used for Svelte.. hmm
	onstats: typeof handleStats | null; // TODO currently just used for Svelte.. hmm
}
export type RequiredOptions = 'dev' | 'log';
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => {
	const tsconfig = opts.tsconfig || loadTsconfig(opts.log);
	const target = toSwcCompilerTarget(tsconfig.compilerOptions?.target);
	const sourceMap = opts.sourceMap ?? tsconfig.compilerOptions?.sourceMap ?? opts.dev;
	const swcOptions = opts.swcOptions || getDefaultSwcOptions(target, sourceMap);
	const svelteCompileOptions: CompileOptions = opts.svelteCompileOptions || {};
	const sveltePreprocessor: PreprocessorGroup | PreprocessorGroup[] | null =
		opts.sveltePreprocessor || sveltePreprocessSwc({swcOptions});
	return {
		onwarn: handleWarn,
		onstats: null,
		...omitUndefined(opts),
		tsconfig,
		swcOptions,
		sourceMap,
		svelteCompileOptions,
		sveltePreprocessor,
	};
};

export const createCompiler = (opts: InitialOptions): Compiler => {
	const {
		log,
		dev,
		sourceMap,
		swcOptions,
		svelteCompileOptions,
		sveltePreprocessor,
		onwarn,
		onstats,
	} = initOptions(opts);

	const compile: Compiler['compile'] = async (
		id: string,
		contents: string | Buffer,
		extension = extname(id),
	): Promise<CompileResult> => {
		switch (extension) {
			case TS_EXTENSION: {
				const finalSwcOptions = mergeSwcOptions(swcOptions, id);
				const output = await swc.transform(contents as string, finalSwcOptions);
				const buildId = toBuildId(id);
				const sourceMapBuildId = buildId + SOURCE_MAP_EXTENSION;
				const compilations: Compilation[] = [
					{
						id: buildId,
						extension: JS_EXTENSION,
						encoding: 'utf8',
						contents: output.map ? addSourceMapFooter(output.code, sourceMapBuildId) : output.code,
						sourceMapOf: null,
					},
				];
				if (output.map) {
					compilations.push({
						id: sourceMapBuildId,
						extension: SOURCE_MAP_EXTENSION,
						encoding: 'utf8',
						contents: output.map,
						sourceMapOf: buildId,
					});
				}
				return {compilations};
			}
			case SVELTE_EXTENSION: {
				let preprocessedCode: string;

				// TODO see rollup-plugin-svelte for how to track deps
				// let dependencies = [];
				if (sveltePreprocessor) {
					const preprocessed = await svelte.preprocess(contents as string, sveltePreprocessor, {
						filename: id,
					});
					preprocessedCode = preprocessed.code;
					// dependencies = preprocessed.dependencies; // TODO
				} else {
					preprocessedCode = contents as string;
				}

				const output: SvelteCompilation = svelte.compile(preprocessedCode, {
					...baseSvelteCompileOptions,
					dev,
					...svelteCompileOptions,
					filename: id,
					// name: getPathStem(id), // TODO this causes warnings with Sapper routes
				});
				const {js, css, warnings, stats} = output;

				for (const warning of warnings) {
					onwarn(id, warning, handleWarn, log);
				}
				if (onstats) onstats(id, stats, handleStats, log);

				const jsBuildId = toBuildId(id);
				const cssBuildId = replaceExtension(jsBuildId, CSS_EXTENSION);

				const compilations: Compilation[] = [
					{
						id: jsBuildId,
						extension: JS_EXTENSION,
						encoding: 'utf8',
						contents: js.code,
						sourceMapOf: null,
					},
				];
				if (sourceMap && js.map) {
					compilations.push({
						id: jsBuildId + SOURCE_MAP_EXTENSION,
						extension: SOURCE_MAP_EXTENSION,
						encoding: 'utf8',
						contents: JSON.stringify(js.map), // TODO do we want to also store the object version?
						sourceMapOf: jsBuildId,
					});
				}
				if (css.code) {
					compilations.push({
						id: cssBuildId,
						extension: CSS_EXTENSION,
						encoding: 'utf8',
						contents: css.code,
						sourceMapOf: null,
					});
					if (sourceMap && css.map) {
						compilations.push({
							id: cssBuildId + SOURCE_MAP_EXTENSION,
							extension: SOURCE_MAP_EXTENSION,
							encoding: 'utf8',
							contents: JSON.stringify(css.map), // TODO do we want to also store the object version?
							sourceMapOf: cssBuildId,
						});
					}
				}
				return {compilations};
			}
			default: {
				const buildId = toBuildId(id);
				const extension = extname(id);
				const encoding = inferEncoding(extension);
				let file: Compilation;
				// TODO simplify this code if we add no additional proeprties - we may add stuff for source maps, though
				switch (encoding) {
					case 'utf8':
						file = {
							id: buildId,
							extension,
							encoding,
							contents: contents as string,
							sourceMapOf: null,
						};
						break;
					case null:
						file = {
							id: buildId,
							extension,
							encoding,
							contents: contents as Buffer,
						};
						break;
					default:
						throw new UnreachableError(encoding);
				}
				return {compilations: [file]};
			}
		}
	};
	return {compile};
};
