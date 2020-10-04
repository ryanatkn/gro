import swc from '@swc/core';
import {relative} from 'path';

import {loadTsconfig, TsConfig} from './tsHelpers.js';
import {toSwcCompilerTarget, getDefaultSwcOptions, addSourceMapFooter} from './swcHelpers.js';
import {Logger, SystemLogger} from '../utils/log.js';
import {JS_EXTENSION, SOURCE_MAP_EXTENSION, toBuildDir, TS_EXTENSION} from '../paths.js';
import {omitUndefined} from '../utils/object.js';
import {CompilationSource, Compiler, TextCompilation} from './compiler.js';
import {replaceExtension} from '../utils/path.js';
import {BuildConfig} from '../project/buildConfig.js';
import {cyan} from '../colors/terminal.js';

export interface Options {
	log: Logger;
	sourceMap: boolean;
	tsconfig: TsConfig;
	swcOptions: swc.Options;
}
export type InitialOptions = Partial<Options>;
export const initOptions = (opts: InitialOptions): Options => {
	const log = opts.log || new SystemLogger([cyan('[swcCompiler]')]);
	const tsconfig = opts.tsconfig || loadTsconfig(log);
	const target = toSwcCompilerTarget(tsconfig.compilerOptions?.target);
	const sourceMap = opts.sourceMap ?? tsconfig.compilerOptions?.sourceMap ?? true;
	const swcOptions = opts.swcOptions || getDefaultSwcOptions(target, sourceMap);
	return {
		...omitUndefined(opts),
		log,
		tsconfig,
		swcOptions,
		sourceMap,
	};
};

type SwcCompiler = Compiler<TextCompilation>;

export const createSwcCompiler = (opts: InitialOptions = {}): SwcCompiler => {
	const {swcOptions} = initOptions(opts);

	const compile: SwcCompiler['compile'] = async (
		source: CompilationSource,
		buildConfig: BuildConfig,
		dev: boolean,
	) => {
		if (source.encoding !== 'utf8') {
			throw Error(`swc only handles utf8 encoding, not ${source.encoding}`);
		}
		if (source.extension !== TS_EXTENSION) {
			throw Error(`swc only handles ${TS_EXTENSION} files, not ${source.extension}`);
		}
		const {id, encoding, contents} = source;
		const outDir = toBuildDir(dev, buildConfig.name, source.dirBasePath, source.sourceDir.outDir);
		const finalSwcOptions = {...swcOptions, filename: relative(outDir, id)};
		const output = await swc.transform(contents, finalSwcOptions);
		const jsFilename = replaceExtension(source.filename, JS_EXTENSION);
		const jsId = `${outDir}${jsFilename}`;
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
