import swc from '@swc/core';
import svelte from 'svelte/compiler.js';
import {PreprocessorGroup} from 'svelte/types/compiler/preprocess';
import {CompileOptions} from 'svelte/types/compiler/interfaces';
import {join} from 'path';

import {loadTsconfig, TsConfig} from './tsHelpers.js';
import {toSwcCompilerTarget, getDefaultSwcOptions} from './swcHelpers.js';
import {
	baseSvelteCompileOptions,
	handleStats,
	handleWarn,
	SvelteCompilation,
} from './svelteHelpers.js';
import {Logger, SystemLogger} from '../utils/log.js';
import {
	CSS_EXTENSION,
	JS_EXTENSION,
	SOURCE_MAP_EXTENSION,
	SVELTE_EXTENSION,
	toBuildDir,
} from '../paths.js';
import {sveltePreprocessSwc} from '../project/svelte-preprocess-swc.js';
import {replaceExtension} from '../utils/path.js';
import {omitUndefined} from '../utils/object.js';
import {Compiler, TextCompilation, TextCompilationSource} from './compiler.js';
import {BuildConfig} from '../project/buildConfig.js';
import {UnreachableError} from '../utils/error.js';
import {cyan} from '../colors/terminal.js';

export interface Options {
	log: Logger;
	sourceMap: boolean;
	tsconfig: TsConfig;
	swcOptions: swc.Options;
	svelteCompileOptions: CompileOptions;
	sveltePreprocessor: PreprocessorGroup | PreprocessorGroup[] | null;
	onwarn: typeof handleWarn;
	onstats: typeof handleStats | null;
}
export type InitialOptions = Partial<Options>;
export const initOptions = (opts: InitialOptions): Options => {
	const log = opts.log || new SystemLogger([cyan('[svelteCompiler]')]);
	const tsconfig = opts.tsconfig || loadTsconfig(log);
	const target = toSwcCompilerTarget(tsconfig.compilerOptions?.target);
	const sourceMap = opts.sourceMap ?? tsconfig.compilerOptions?.sourceMap ?? true;
	const swcOptions = opts.swcOptions || getDefaultSwcOptions(target, sourceMap);
	const svelteCompileOptions: CompileOptions = opts.svelteCompileOptions || {};
	const sveltePreprocessor: PreprocessorGroup | PreprocessorGroup[] | null =
		opts.sveltePreprocessor || sveltePreprocessSwc({swcOptions});
	return {
		onwarn: handleWarn,
		onstats: null,
		...omitUndefined(opts),
		log,
		tsconfig,
		swcOptions,
		sourceMap,
		svelteCompileOptions,
		sveltePreprocessor,
	};
};

type SvelteCompiler = Compiler<TextCompilation>;

export const createSvelteCompiler = (opts: InitialOptions = {}): SvelteCompiler => {
	const {log, sourceMap, svelteCompileOptions, sveltePreprocessor, onwarn, onstats} = initOptions(
		opts,
	);

	const compile: SvelteCompiler['compile'] = async (
		source: TextCompilationSource,
		buildConfig: BuildConfig,
		dev: boolean,
	) => {
		if (source.encoding !== 'utf8') {
			throw Error(`swc only handles utf8 encoding, not ${source.encoding}`);
		}
		if (source.extension !== SVELTE_EXTENSION) {
			throw Error(`svelte only handles ${SVELTE_EXTENSION} files, not ${source.extension}`);
		}
		const {id, encoding, contents} = source;
		const outDir = toBuildDir(dev, buildConfig.name, source.dirBasePath);
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
			generate: getGenerateOption(buildConfig), // allow `svelteCompileOptions` to override
			...svelteCompileOptions,
			filename: id, // TODO should we be giving a different path?
		});
		const {js, css, warnings, stats} = output;

		for (const warning of warnings) {
			onwarn(id, warning, handleWarn, log);
		}
		if (onstats) onstats(id, stats, handleStats, log);

		const jsFilename = replaceExtension(source.filename, JS_EXTENSION);
		const cssFilename = replaceExtension(jsFilename, CSS_EXTENSION);
		const jsId = join(outDir, jsFilename);
		const cssId = replaceExtension(jsId, CSS_EXTENSION);

		const compilations: TextCompilation[] = [
			{
				id: jsId,
				filename: jsFilename,
				dir: outDir,
				extension: JS_EXTENSION,
				encoding,
				contents: js.code,
				sourceMapOf: null,
			},
		];
		if (sourceMap && js.map) {
			compilations.push({
				id: jsId + SOURCE_MAP_EXTENSION,
				filename: jsFilename + SOURCE_MAP_EXTENSION,
				dir: outDir,
				extension: SOURCE_MAP_EXTENSION,
				encoding,
				contents: JSON.stringify(js.map), // TODO do we want to also store the object version?
				sourceMapOf: jsId,
			});
		}
		if (css.code) {
			compilations.push({
				id: cssId,
				filename: cssFilename,
				dir: outDir,
				extension: CSS_EXTENSION,
				encoding,
				contents: css.code,
				sourceMapOf: null,
			});
			if (sourceMap && css.map) {
				compilations.push({
					id: cssId + SOURCE_MAP_EXTENSION,
					filename: cssFilename + SOURCE_MAP_EXTENSION,
					dir: outDir,
					extension: SOURCE_MAP_EXTENSION,
					encoding,
					contents: JSON.stringify(css.map), // TODO do we want to also store the object version?
					sourceMapOf: cssId,
				});
			}
		}
		return {compilations};
	};

	return {compile};
};

const getGenerateOption = (buildConfig: BuildConfig): 'dom' | 'ssr' | false => {
	switch (buildConfig.platform) {
		case 'browser':
			return 'dom';
		case 'node':
			return 'ssr';
		default:
			throw new UnreachableError(buildConfig.platform);
	}
};
