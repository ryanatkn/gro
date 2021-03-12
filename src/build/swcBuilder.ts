import swc from '@swc/core';
import {relative} from 'path';

import {EcmaScriptTarget} from './tsBuildHelpers.js';
import {getDefaultSwcOptions} from './swcBuildHelpers.js';
import {Logger, SystemLogger} from '../utils/log.js';
import {JS_EXTENSION, SOURCEMAP_EXTENSION, toBuildOutPath, TS_EXTENSION} from '../paths.js';
import {omitUndefined} from '../utils/object.js';
import type {Builder, BuildResult, TextBuild, TextBuildSource} from './builder.js';
import {replaceExtension} from '../utils/path.js';
import {cyan} from '../colors/terminal.js';
import {addJsSourceMapFooter} from './buildHelpers.js';

export interface Options {
	log: Logger;
	// TODO changes to this by consumers can break caching - how can the DX be improved?
	createSwcOptions: CreateSwcOptions;
}
export type InitialOptions = Partial<Options>;
export const initOptions = (opts: InitialOptions): Options => {
	return {
		createSwcOptions: createDefaultSwcOptions,
		...omitUndefined(opts),
		log: opts.log || new SystemLogger([cyan('[swcBuilder]')]),
	};
};

type SwcBuilder = Builder<TextBuildSource, TextBuild>;

export const createSwcBuilder = (opts: InitialOptions = {}): SwcBuilder => {
	const {createSwcOptions} = initOptions(opts);

	const swcOptionsCache: Map<string, swc.Options> = new Map();
	const getSwcOptions = (sourceMap: boolean, target: EcmaScriptTarget): swc.Options => {
		const key = sourceMap + target;
		const existingSwcOptions = swcOptionsCache.get(key);
		if (existingSwcOptions !== undefined) return existingSwcOptions;
		const newSwcOptions = createSwcOptions(sourceMap, target);
		swcOptionsCache.set(key, newSwcOptions);
		return newSwcOptions;
	};

	const build: SwcBuilder['build'] = async (
		source,
		buildConfig,
		{buildDir, dev, sourceMap, target},
	) => {
		if (source.encoding !== 'utf8') {
			throw Error(`swc only handles utf8 encoding, not ${source.encoding}`);
		}
		if (source.extension !== TS_EXTENSION) {
			throw Error(`swc only handles ${TS_EXTENSION} files, not ${source.extension}`);
		}
		const {id, encoding, contents} = source;
		const outDir = toBuildOutPath(dev, buildConfig.name, source.dirBasePath, buildDir);
		const swcOptions = getSwcOptions(sourceMap, target);
		const finalSwcOptions = {...swcOptions, filename: relative(outDir, id)};
		const output = await swc.transform(contents, finalSwcOptions);
		const jsFilename = replaceExtension(source.filename, JS_EXTENSION);
		const jsId = `${outDir}${jsFilename}`;
		const builds: TextBuild[] = [
			{
				id: jsId,
				filename: jsFilename,
				dir: outDir,
				extension: JS_EXTENSION,
				encoding,
				contents: output.map
					? addJsSourceMapFooter(output.code, jsFilename + SOURCEMAP_EXTENSION)
					: output.code,
				sourceMapOf: null,
				buildConfig,
			},
		];
		if (output.map) {
			builds.push({
				id: jsId + SOURCEMAP_EXTENSION,
				filename: jsFilename + SOURCEMAP_EXTENSION,
				dir: outDir,
				extension: SOURCEMAP_EXTENSION,
				encoding,
				contents: output.map,
				sourceMapOf: jsId,
				buildConfig,
			});
		}
		const result: BuildResult<TextBuild> = {builds};
		return result;
	};

	return {build};
};

type CreateSwcOptions = (sourceMap: boolean, target: EcmaScriptTarget) => swc.Options;

const createDefaultSwcOptions: CreateSwcOptions = (sourceMap, target) =>
	getDefaultSwcOptions(target, sourceMap);
