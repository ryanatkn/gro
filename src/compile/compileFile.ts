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
	SOURCE_MAP_EXTENSION,
	SVELTE_EXTENSION,
	toBuildId,
	TS_EXTENSION,
} from '../paths.js';
import {sveltePreprocessSwc} from '../project/svelte-preprocess-swc.js';
import {replaceExtension} from '../utils/path.js';
import {omitUndefined} from '../utils/object.js';

export interface CompileFile {
	(id: string, contents: string, extension?: string): Promise<CompileResult>;
}
export interface CompileResult {
	// TODO might need to be a union with a type, like `extension: '.svelte'` with additional properties.
	// Svelte compilation properties include `ast`, `warnings`, `vars`, and `stats`
	files: CompiledFile[];
}

// TODO name? so close to `CompileFile` - maybe that should be renamed `FileCompiler`?
export interface CompiledFile {
	id: string;
	contents: string;
	sourceMapOf?: string; // TODO for source maps? hmm. maybe we want a union with an `isSourceMap` boolean flag?
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
	onstats: typeof handleStats; // TODO currently just used for Svelte.. hmm
}
export type RequiredOptions = 'dev' | 'log';
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => {
	const tsconfig = opts.tsconfig || loadTsconfig(opts.log);
	const target = toSwcCompilerTarget(tsconfig.compilerOptions?.target);
	const sourceMap = opts.sourceMap ?? tsconfig.compilerOptions?.sourceMap ?? opts.dev; // TODO I think Svelte just enables these in in "dev" so...
	const swcOptions = opts.swcOptions || getDefaultSwcOptions(target, sourceMap);
	const svelteCompileOptions: CompileOptions = opts.svelteCompileOptions || {};
	const sveltePreprocessor: PreprocessorGroup | PreprocessorGroup[] | null =
		opts.sveltePreprocessor || sveltePreprocessSwc({swcOptions});
	return {
		onwarn: handleWarn,
		onstats: handleStats,
		...omitUndefined(opts),
		tsconfig,
		swcOptions,
		sourceMap,
		svelteCompileOptions,
		sveltePreprocessor,
	};
};

// TODO maybe make this optionally synchronous, so not `async` and not using promises when not needeD?
// TODO how should options be handled? and additional file type compilations?
// should `swcOptions` be passed in instead? Required or optional?
// Or is this the friendliest way to do it,
// so consumers can instantiate the `CachingCompiler` without any options?
export const createCompileFile = (opts: InitialOptions): CompileFile => {
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

	const compileFile: CompileFile = async (
		id: string,
		contents: string,
		extension = extname(id),
	): Promise<CompileResult> => {
		switch (extension) {
			case TS_EXTENSION: {
				const finalSwcOptions = mergeSwcOptions(swcOptions, id);
				const output = await swc.transform(contents, finalSwcOptions);
				const buildId = toBuildId(id);
				const sourceMapBuildId = buildId + SOURCE_MAP_EXTENSION;
				const files: CompiledFile[] = [
					{
						id: buildId,
						contents: output.map ? addSourceMapFooter(output.code, sourceMapBuildId) : output.code,
					},
				];
				if (output.map) {
					files.push({
						id: sourceMapBuildId,
						contents: output.map,
						sourceMapOf: buildId,
					});
				}
				return {files};
			}
			// TODO Svelte, see `src/build/rollup-plugin-gro-svelte.ts`
			// Need to rework the caching compiler API to handle multiple output files.
			// We should also unify this API with `GenFile` and the rest.
			case SVELTE_EXTENSION: {
				let preprocessedCode: string;

				// TODO see rollup-plugin-svelte for how to track deps
				// let dependencies = [];
				if (sveltePreprocessor) {
					// log.trace('preprocess', printPath(id));
					const preprocessed = await svelte.preprocess(contents, sveltePreprocessor, {
						filename: id,
					});
					preprocessedCode = preprocessed.code;
					// dependencies = preprocessed.dependencies; // TODO
				} else {
					preprocessedCode = contents;
				}

				// log.trace('compile', printPath(id));
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
				onstats(id, stats, handleStats, log);

				const jsBuildId = toBuildId(id);
				const cssBuildId = replaceExtension(jsBuildId, CSS_EXTENSION);

				const files: CompiledFile[] = [{id: jsBuildId, contents: js.code}];
				if (sourceMap && js.map) {
					files.push({
						id: jsBuildId + SOURCE_MAP_EXTENSION,
						contents: JSON.stringify(js.map), // TODO ??? do we want to also store the object version?
						sourceMapOf: jsBuildId,
					});
				}
				if (css.code) {
					files.push({id: cssBuildId, contents: css.code});
					if (sourceMap && css.map) {
						files.push({
							id: cssBuildId + SOURCE_MAP_EXTENSION,
							contents: JSON.stringify(css.map), // TODO ??? do we want to also store the object version?
							sourceMapOf: cssBuildId,
						});
					}
				}
				return {files};
			}
			default: {
				return {files: [{id, contents}]};
			}
		}
	};
	return compileFile;
};
