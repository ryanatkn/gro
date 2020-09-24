import {extname} from 'path';
import swc from '@swc/core';
import svelte from 'svelte/compiler.js';
import {PreprocessorGroup} from 'svelte/types/compiler/preprocess';
import {CompileOptions} from 'svelte/types/compiler/interfaces';

import {loadTsconfig} from './tsHelpers.js';
import {
	toSwcCompilerTarget,
	mergeSwcOptions,
	getDefaultSwcOptions,
	addSourceMapFooter,
} from './swcHelpers.js';
import {baseSvelteCompileOptions, SvelteCompilation} from './svelteHelpers.js';
import {Logger} from '../utils/log.js';
import {
	CSS_EXTENSION,
	SOURCE_MAP_EXTENSION,
	SVELTE_EXTENSION,
	toBuildId,
	TS_EXTENSION,
} from '../paths.js';
import {sveltePreprocessSwc} from '../project/svelte-preprocess-swc.js';
import {getPathStem, replaceExtension} from '../utils/path.js';

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

// TODO maybe make this optionally synchronous, so not `async` and not using promises when not needeD?
// TODO how should options be handled? and additional file type compilations?
// should `swcOptions` be passed in instead? Required or optional?
// Or is this the friendliest way to do it,
// so consumers can instantiate the `CachingCompiler` without any options?
export const createCompileFile = (log: Logger): CompileFile => {
	const dev = process.env.NODE_ENV === 'development'; // TODO
	// load the TypeScript and swc options
	// TODO somehow parameterize these
	const tsconfigPath = undefined;
	const basePath = undefined;
	const tsconfig = loadTsconfig(log, tsconfigPath, basePath);
	const target = toSwcCompilerTarget(tsconfig.compilerOptions?.target);
	const sourceMap = tsconfig.compilerOptions?.sourceMap ?? dev;
	const swcOptions = getDefaultSwcOptions(target, sourceMap);

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
				// TODO options
				const svelteOptions: CompileOptions = {};
				const sveltePreprocessor:
					| PreprocessorGroup
					| PreprocessorGroup[]
					| null = sveltePreprocessSwc({
					swcOptions,
				});

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
					...svelteOptions,
					filename: id,
					name: getPathStem(id),
				});
				const {js, css /*, warnings, stats*/} = output;

				// for (const warning of warnings) {
				// 	onwarn(id, warning, handleWarn, this, log);
				// }

				const jsBuildId = toBuildId(id);
				const cssBuildId = replaceExtension(jsBuildId, CSS_EXTENSION);

				const files: CompiledFile[] = [{id: jsBuildId, contents: js.code}];
				if (js.map) {
					files.push({
						id: jsBuildId + SOURCE_MAP_EXTENSION,
						contents: JSON.stringify(js.map), // TODO ??? do we want to also store the object version?
						sourceMapOf: jsBuildId,
					});
				}
				if (css.code) {
					files.push({id: cssBuildId, contents: css.code});
					if (css.map) {
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
