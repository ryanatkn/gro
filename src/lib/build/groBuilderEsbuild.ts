import esbuild from 'esbuild';
import {replaceExtension} from '@feltjs/util/path.js';

import {toDefaultEsbuildOptions} from './groBuilderEsbuildUtils.js';
import {JS_EXTENSION, SOURCEMAP_EXTENSION, toBuildOutPath, TS_EXTENSION} from '../path/paths.js';
import type {Builder, TextBuildSource} from './builder.js';
import {addJsSourcemapFooter, type EcmaScriptTarget} from './helpers.js';
import type {BuildFile} from './buildFile.js';
import {postprocess} from './postprocess.js';

export interface Options {
	// TODO changes to this by consumers can break caching - how can the DX be improved?
	createEsbuildOptions?: CreateEsbuildOptions;
}

type EsbuildBuilder = Builder<TextBuildSource>;

export const groBuilderEsbuild = (options: Options = {}): EsbuildBuilder => {
	const {createEsbuildOptions = defaultCreateEsbuildOptions} = options;

	const esbuildOptionsCache: Map<string, esbuild.TransformOptions> = new Map();
	const getEsbuildOptions = (
		target: EcmaScriptTarget,
		dev: boolean,
		sourcemap: boolean,
	): esbuild.TransformOptions => {
		const key = sourcemap + target;
		const existingEsbuildOptions = esbuildOptionsCache.get(key);
		if (existingEsbuildOptions !== undefined) return existingEsbuildOptions;
		const newEsbuildOptions = createEsbuildOptions(dev, target, sourcemap);
		esbuildOptionsCache.set(key, newEsbuildOptions);
		return newEsbuildOptions;
	};

	const build: EsbuildBuilder['build'] = async (source, buildConfig, ctx) => {
		const {buildDir, dev, sourcemap, target} = ctx;

		if (source.encoding !== 'utf8') {
			throw Error(`esbuild only handles utf8 encoding, not ${source.encoding}`);
		}
		if (source.extension !== TS_EXTENSION && source.extension !== JS_EXTENSION) {
			throw Error(`esbuild cannot handled file with extension ${source.extension}`);
		}

		const outDir = toBuildOutPath(dev, buildConfig.name, source.dirBasePath, buildDir);
		const esbuildOptions = {
			...getEsbuildOptions(target, dev, sourcemap),
			sourcefile: source.id,
		};
		const output = await esbuild.transform(source.content, esbuildOptions);
		const jsFilename = replaceExtension(source.filename, JS_EXTENSION);
		const jsId = `${outDir}${jsFilename}`;

		const buildFiles: BuildFile[] = [
			{
				type: 'build',
				sourceId: source.id,
				buildConfig,
				dependencies: null,
				id: jsId,
				filename: jsFilename,
				dir: outDir,
				extension: JS_EXTENSION,
				encoding: source.encoding,
				content: output.map
					? addJsSourcemapFooter(output.code, jsFilename + SOURCEMAP_EXTENSION)
					: output.code,
				contentBuffer: undefined,
				contentHash: undefined,
				stats: undefined,
				mimeType: undefined,
			},
		];
		if (output.map) {
			buildFiles.push({
				type: 'build',
				sourceId: source.id,
				buildConfig,
				dependencies: null,
				id: jsId + SOURCEMAP_EXTENSION,
				filename: jsFilename + SOURCEMAP_EXTENSION,
				dir: outDir,
				extension: SOURCEMAP_EXTENSION,
				encoding: source.encoding,
				content: output.map,
				contentBuffer: undefined,
				contentHash: undefined,
				stats: undefined,
				mimeType: undefined,
			});
		}

		await Promise.all(buildFiles.map((buildFile) => postprocess(buildFile, ctx, source)));
		return buildFiles;
	};

	return {name: '@feltjs/groBuilderEsbuild', build};
};

type CreateEsbuildOptions = (
	dev: boolean,
	target: EcmaScriptTarget,
	sourcemap: boolean,
) => esbuild.TransformOptions;

const defaultCreateEsbuildOptions: CreateEsbuildOptions = (dev, target, sourcemap) =>
	toDefaultEsbuildOptions(dev, target, sourcemap);