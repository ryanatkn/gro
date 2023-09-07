import esbuild from 'esbuild';
import type {Assignable} from '@feltjs/util/types.js';

import {to_default_esbuild_options} from './gro_builder_esbuild_utils.js';
import {
	JS_EXTENSION,
	SOURCEMAP_EXTENSION,
	to_build_out_path,
	TS_EXTENSION,
	replace_extension,
} from '../path/paths.js';
import type {Builder} from './builder.js';
import {addJsSourcemapFooter, type EcmaScriptTarget} from './helpers.js';
import type {BuildFile} from './buildFile.js';
import {postprocess} from './postprocess.js';
import type {TextSourceFile} from './sourceFile.js';

export interface Options {
	// TODO changes to this by consumers can break caching - how can the DX be improved?
	create_esbuild_options?: CreateEsbuildOptions;
}

type EsbuildBuilder = Builder<TextSourceFile>;

export const gro_builder_esbuild = (options: Options = {}): EsbuildBuilder => {
	const {create_esbuild_options = default_create_esbuild_options} = options;

	const esbuildOptionsCache: Map<string, esbuild.TransformOptions> = new Map();
	const getEsbuildOptions = (
		target: EcmaScriptTarget,
		dev: boolean,
		sourcemap: boolean,
	): esbuild.TransformOptions => {
		const key = sourcemap + target;
		const existingEsbuildOptions = esbuildOptionsCache.get(key);
		if (existingEsbuildOptions !== undefined) return existingEsbuildOptions;
		const newEsbuildOptions = create_esbuild_options(dev, target, sourcemap);
		esbuildOptionsCache.set(key, newEsbuildOptions);
		return newEsbuildOptions;
	};

	const build: EsbuildBuilder['build'] = async (source, buildConfig, ctx) => {
		const {build_dir, dev, target} = ctx;

		const sourcemap = ctx.sourcemap && !source.virtual;

		if (source.encoding !== 'utf8') {
			throw Error(`esbuild only handles utf8 encoding, not ${source.encoding}`);
		}
		if (source.extension !== TS_EXTENSION && source.extension !== JS_EXTENSION) {
			throw Error(`esbuild cannot handled file with extension ${source.extension}`);
		}

		const outDir = to_build_out_path(dev, buildConfig.name, source.dirBasePath, build_dir);
		const esbuildOptions = {
			...getEsbuildOptions(target, dev, sourcemap),
			sourcefile: source.id,
		};
		const output = await esbuild.transform(source.content, esbuildOptions);
		const jsFilename = replace_extension(source.filename, JS_EXTENSION);
		const jsId = `${outDir}${jsFilename}`;

		const buildFiles: BuildFile[] = [
			{
				type: 'build',
				source_id: source.id,
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
				source_id: source.id,
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

		await Promise.all(
			buildFiles.map(async (buildFile) => {
				const {content, extension, dir} = buildFile;
				if (typeof content !== 'string' || extension !== JS_EXTENSION) return;
				const processed = postprocess(content, dir, source.dir, JS_EXTENSION);
				(buildFile as Assignable<BuildFile, 'content'>).content = processed.content;
				(buildFile as Assignable<BuildFile, 'dependencies'>).dependencies = processed.dependencies;
			}),
		);
		return buildFiles;
	};

	return {name: 'gro_builder_esbuild', build};
};

type CreateEsbuildOptions = (
	dev: boolean,
	target: EcmaScriptTarget,
	sourcemap: boolean,
) => esbuild.TransformOptions;

const default_create_esbuild_options: CreateEsbuildOptions = (dev, target, sourcemap) =>
	to_default_esbuild_options(dev, target, sourcemap);
