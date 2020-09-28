import swc from '@swc/core';
import svelte from 'svelte/compiler.js';
import {PreprocessorGroup} from 'svelte/types/compiler/preprocess';
import {CompileOptions} from 'svelte/types/compiler/interfaces';

import {loadTsconfig, TsConfig} from './tsHelpers.js';
import {toSwcCompilerTarget, getDefaultSwcOptions} from './swcHelpers.js';
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
} from '../paths.js';
import {sveltePreprocessSwc} from '../project/svelte-preprocess-swc.js';
import {replaceExtension} from '../utils/path.js';
import {omitUndefined} from '../utils/object.js';
import {Compiler, TextCompilation, TextCompilationSource} from './compiler.js';

export interface Options {
	dev: boolean;
	log: Logger;
	sourceMap: boolean;
	tsconfig: TsConfig;
	swcOptions: swc.Options;
	svelteCompileOptions: CompileOptions;
	sveltePreprocessor: PreprocessorGroup | PreprocessorGroup[] | null;
	onwarn: typeof handleWarn;
	onstats: typeof handleStats | null;
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

type SvelteCompiler = Compiler<TextCompilation>;

export const createSvelteCompiler = (opts: InitialOptions): SvelteCompiler => {
	const {
		log,
		dev,
		sourceMap,
		svelteCompileOptions,
		sveltePreprocessor,
		onwarn,
		onstats,
	} = initOptions(opts);

	const compile: SvelteCompiler['compile'] = async (source: TextCompilationSource) => {
		if (source.encoding !== 'utf8') {
			throw Error(`swc only handles utf8 encoding, not ${source.encoding}`);
		}
		if (source.extension !== SVELTE_EXTENSION) {
			throw Error(`svelte only handles ${SVELTE_EXTENSION} files, not ${source.extension}`);
		}
		const {id, encoding, contents} = source;
		let preprocessedCode: string;

		// TODO see rollup-plugin-svelte for how to track deps
		// let dependencies = [];
		if (sveltePreprocessor) {
			const preprocessed = await svelte.preprocess(contents, sveltePreprocessor, {
				filename: id,
			});
			preprocessedCode = preprocessed.code;
			// dependencies = preprocessed.dependencies; // TODO
		} else {
			preprocessedCode = contents;
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

		const compilations: TextCompilation[] = [
			{
				id: jsBuildId,
				extension: JS_EXTENSION,
				encoding,
				contents: js.code,
				sourceMapOf: null,
			},
		];
		if (sourceMap && js.map) {
			compilations.push({
				id: jsBuildId + SOURCE_MAP_EXTENSION,
				extension: SOURCE_MAP_EXTENSION,
				encoding,
				contents: JSON.stringify(js.map), // TODO do we want to also store the object version?
				sourceMapOf: jsBuildId,
			});
		}
		if (css.code) {
			compilations.push({
				id: cssBuildId,
				extension: CSS_EXTENSION,
				encoding,
				contents: css.code,
				sourceMapOf: null,
			});
			if (sourceMap && css.map) {
				compilations.push({
					id: cssBuildId + SOURCE_MAP_EXTENSION,
					extension: SOURCE_MAP_EXTENSION,
					encoding,
					contents: JSON.stringify(css.map), // TODO do we want to also store the object version?
					sourceMapOf: cssBuildId,
				});
			}
		}
		return {compilations};
	};

	return {compile};
};
