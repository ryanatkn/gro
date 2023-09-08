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
import {add_js_sourcemap_footer, type EcmaScriptTarget} from './helpers.js';
import type {BuildFile} from './build_file.js';
import {postprocess} from './postprocess.js';
import type {SourceFile} from './source_file.js';

export interface Options {
	// TODO changes to this by consumers can break caching - how can the DX be improved?
	create_esbuild_options?: CreateEsbuildOptions;
}

type EsbuildBuilder = Builder<SourceFile>;

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

	const build: EsbuildBuilder['build'] = async (source, build_config, ctx) => {
		const {build_dir, dev, target} = ctx;

		const sourcemap = ctx.sourcemap && !source.virtual;

		if (source.extension !== TS_EXTENSION && source.extension !== JS_EXTENSION) {
			throw Error(`esbuild cannot handled file with extension ${source.extension}`);
		}

		const outDir = to_build_out_path(dev, build_config.name, source.dir_base_path, build_dir);
		const esbuildOptions = {
			...getEsbuildOptions(target, dev, sourcemap),
			sourcefile: source.id,
		};
		const output = await esbuild.transform(source.content, esbuildOptions);
		const jsFilename = replace_extension(source.filename, JS_EXTENSION);
		const jsId = `${outDir}${jsFilename}`;

		const build_files: BuildFile[] = [
			{
				type: 'build',
				source_id: source.id,
				build_config,
				dependencies: null,
				id: jsId,
				filename: jsFilename,
				dir: outDir,
				extension: JS_EXTENSION,
				content: output.map
					? add_js_sourcemap_footer(output.code, jsFilename + SOURCEMAP_EXTENSION)
					: output.code,
				content_buffer: undefined,
				content_hash: undefined,
				stats: undefined,
			},
		];
		if (output.map) {
			build_files.push({
				type: 'build',
				source_id: source.id,
				build_config,
				dependencies: null,
				id: jsId + SOURCEMAP_EXTENSION,
				filename: jsFilename + SOURCEMAP_EXTENSION,
				dir: outDir,
				extension: SOURCEMAP_EXTENSION,
				content: output.map,
				content_buffer: undefined,
				content_hash: undefined,
				stats: undefined,
			});
		}

		await Promise.all(
			build_files.map(async (build_file) => {
				const {content, extension, dir} = build_file;
				if (typeof content !== 'string' || extension !== JS_EXTENSION) return;
				const processed = postprocess(content, dir, source.dir, JS_EXTENSION);
				(build_file as Assignable<BuildFile, 'content'>).content = processed.content;
				(build_file as Assignable<BuildFile, 'dependencies'>).dependencies = processed.dependencies;
			}),
		);
		return build_files;
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
