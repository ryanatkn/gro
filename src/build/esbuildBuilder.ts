import esbuild from 'esbuild';

import type {EcmaScriptTarget} from './tsBuildHelpers.js';
import {getDefaultEsbuildOptions} from './esbuildBuildHelpers.js';
import {SystemLogger, printLogLabel} from '../utils/log.js';
import type {Logger} from '../utils/log.js';
import {
	JS_EXTENSION,
	SOURCEMAP_EXTENSION,
	toBuildOutPath,
	TS_DEFS_EXTENSION,
	TS_EXTENSION,
} from '../paths.js';
import {omitUndefined} from '../utils/object.js';
import type {Builder, BuildResult, TextBuild, TextBuildSource} from './builder.js';
import {replaceExtension} from '../utils/path.js';
import {cyan} from '../utils/terminal.js';
import {addJsSourcemapFooter} from './utils.js';

export interface Options {
	log: Logger;
	// TODO changes to this by consumers can break caching - how can the DX be improved?
	createEsbuildOptions: CreateEsbuildOptions;
	generateTypes: null | ((id: string) => Promise<string>);
}
export type InitialOptions = Partial<Options>;
export const initOptions = (opts: InitialOptions): Options => {
	return {
		createEsbuildOptions: createDefaultEsbuildOptions,
		generateTypes: null,
		...omitUndefined(opts),
		log: opts.log || new SystemLogger(printLogLabel('esbuildBuilder', cyan)),
	};
};

type EsbuildBuilder = Builder<TextBuildSource, TextBuild>;

export const createEsbuildBuilder = (opts: InitialOptions = {}): EsbuildBuilder => {
	const {createEsbuildOptions, generateTypes} = initOptions(opts);

	const esbuildOptionsCache: Map<string, esbuild.TransformOptions> = new Map();
	const getEsbuildOptions = (
		target: EcmaScriptTarget,
		dev: boolean,
		sourcemap: boolean,
	): esbuild.TransformOptions => {
		const key = sourcemap + target;
		const existingEsbuildOptions = esbuildOptionsCache.get(key);
		if (existingEsbuildOptions !== undefined) return existingEsbuildOptions;
		const newEsbuildOptions = createEsbuildOptions(target, dev, sourcemap);
		esbuildOptionsCache.set(key, newEsbuildOptions);
		return newEsbuildOptions;
	};

	const build: EsbuildBuilder['build'] = async (
		source,
		buildConfig,
		{buildDir, dev, sourcemap, target},
	) => {
		if (source.encoding !== 'utf8') {
			throw Error(`esbuild only handles utf8 encoding, not ${source.encoding}`);
		}
		if (source.extension !== TS_EXTENSION) {
			throw Error(`esbuild only handles ${TS_EXTENSION} files, not ${source.extension}`);
		}
		const outDir = toBuildOutPath(dev, buildConfig.name, source.dirBasePath, buildDir);
		const esbuildOptions = {
			...getEsbuildOptions(target, dev, sourcemap),
			sourcefile: source.id,
		};
		const output = await esbuild.transform(source.contents, esbuildOptions);
		const jsFilename = replaceExtension(source.filename, JS_EXTENSION);
		const jsId = `${outDir}${jsFilename}`;
		const builds: TextBuild[] = [
			{
				id: jsId,
				filename: jsFilename,
				dir: outDir,
				extension: JS_EXTENSION,
				encoding: source.encoding,
				contents: output.map
					? addJsSourcemapFooter(output.code, jsFilename + SOURCEMAP_EXTENSION)
					: output.code,
				buildConfig,
			},
		];
		if (output.map) {
			builds.push({
				id: jsId + SOURCEMAP_EXTENSION,
				filename: jsFilename + SOURCEMAP_EXTENSION,
				dir: outDir,
				extension: SOURCEMAP_EXTENSION,
				encoding: source.encoding,
				contents: output.map,
				buildConfig,
			});
		}
		if (generateTypes) {
			builds.push({
				id: replaceExtension(jsId, TS_DEFS_EXTENSION),
				filename: replaceExtension(jsFilename, TS_DEFS_EXTENSION),
				dir: outDir,
				extension: TS_DEFS_EXTENSION,
				encoding: source.encoding,
				contents: await generateTypes(source.id),
				buildConfig,
			});
		}
		const result: BuildResult<TextBuild> = {builds};
		return result;
	};

	return {name: 'gro-builder-esbuild', build};
};

type CreateEsbuildOptions = (
	target: EcmaScriptTarget,
	dev: boolean,
	sourcemap: boolean,
) => esbuild.TransformOptions;

const createDefaultEsbuildOptions: CreateEsbuildOptions = (target, dev, sourcemap) =>
	getDefaultEsbuildOptions(target, dev, sourcemap);
