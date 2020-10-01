import swc from '@swc/core';
import {join} from 'path';

import {loadTsconfig, TsConfig} from './tsHelpers.js';
import {
	toSwcCompilerTarget,
	mergeSwcOptions,
	getDefaultSwcOptions,
	addSourceMapFooter,
} from './swcHelpers.js';
import {Logger} from '../utils/log.js';
import {JS_EXTENSION, SOURCE_MAP_EXTENSION, TS_EXTENSION} from '../paths.js';
import {omitUndefined} from '../utils/object.js';
import {CompilationSource, Compiler, TextCompilation} from './compiler.js';
import {replaceExtension} from '../utils/path.js';

export interface Options {
	dev: boolean;
	log: Logger;
	sourceMap: boolean;
	tsconfig: TsConfig;
	swcOptions: swc.Options;
}
export type RequiredOptions = 'dev' | 'log';
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => {
	const tsconfig = opts.tsconfig || loadTsconfig(opts.log);
	const target = toSwcCompilerTarget(tsconfig.compilerOptions?.target);
	const sourceMap = opts.sourceMap ?? tsconfig.compilerOptions?.sourceMap ?? opts.dev;
	const swcOptions = opts.swcOptions || getDefaultSwcOptions(target, sourceMap);
	return {
		...omitUndefined(opts),
		tsconfig,
		swcOptions,
		sourceMap,
	};
};

type SwcCompiler = Compiler<TextCompilation>;

export const createSwcCompiler = (opts: InitialOptions): SwcCompiler => {
	const {swcOptions} = initOptions(opts);

	const compile: SwcCompiler['compile'] = async (source: CompilationSource) => {
		if (source.encoding !== 'utf8') {
			throw Error(`swc only handles utf8 encoding, not ${source.encoding}`);
		}
		if (source.extension !== TS_EXTENSION) {
			throw Error(`swc only handles ${TS_EXTENSION} files, not ${source.extension}`);
		}
		const {id, encoding, contents, outDir} = source;
		const finalSwcOptions = mergeSwcOptions(swcOptions, id); // TODO take a look at this id translation
		const output = await swc.transform(contents, finalSwcOptions);
		const jsFilename = replaceExtension(source.filename, JS_EXTENSION);
		const jsId = join(outDir, jsFilename);
		const sourceMapBuildId = jsId + SOURCE_MAP_EXTENSION;
		const compilations: TextCompilation[] = [
			{
				id: jsId,
				filename: jsFilename,
				dir: outDir,
				extension: JS_EXTENSION,
				encoding,
				contents: output.map ? addSourceMapFooter(output.code, sourceMapBuildId) : output.code,
				sourceMapOf: null,
			},
		];
		if (output.map) {
			compilations.push({
				id: sourceMapBuildId,
				filename: jsFilename + SOURCE_MAP_EXTENSION,
				dir: outDir,
				extension: SOURCE_MAP_EXTENSION,
				encoding,
				contents: output.map,
				sourceMapOf: jsId,
			});
		}
		return {compilations};
	};

	return {compile};
};
