import esbuild from 'esbuild';
import {System_Logger, print_log_label} from '@feltcoop/felt/util/log.js';
import type {Logger} from '@feltcoop/felt/util/log.js';
import {omit_undefined} from '@feltcoop/felt/util/object.js';
import {replace_extension} from '@feltcoop/felt/util/path.js';
import {cyan} from '@feltcoop/felt/util/terminal.js';

import type {Ecma_Script_Target, Generate_Types_For_File} from './ts_build_helpers.js';
import {to_default_esbuild_options} from './esbuild_build_helpers.js';
import {
	JS_EXTENSION,
	SOURCEMAP_EXTENSION,
	to_build_out_path,
	TS_TYPE_EXTENSION,
	TS_EXTENSION,
	TS_TYPEMAP_EXTENSION,
} from '../paths.js';
import type {Builder, Text_Build_Source} from './builder.js';
import {add_js_sourcemap_footer} from './utils.js';
import {to_generate_types_for_file} from './ts_build_helpers.js';
import type {Filesystem} from '../fs/filesystem.js';
import type {Build_File} from './build_file.js';

export interface Options {
	log: Logger;
	// TODO changes to this by consumers can break caching - how can the DX be improved?
	createEsbuildOptions: Create_Esbuild_Options;
}
export type Initial_Options = Partial<Options>;
export const init_options = (opts: Initial_Options): Options => {
	return {
		createEsbuildOptions: create_default_esbuild_options,
		...omit_undefined(opts),
		log: opts.log || new System_Logger(print_log_label('esbuild_builder', cyan)),
	};
};

type EsbuildBuilder = Builder<Text_Build_Source>;

export const create_esbuild_builder = (opts: Initial_Options = {}): EsbuildBuilder => {
	const {createEsbuildOptions} = init_options(opts);

	const esbuildOptionsCache: Map<string, esbuild.TransformOptions> = new Map();
	const getEsbuildOptions = (
		target: Ecma_Script_Target,
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

	let cachedGenerateTypes: Map<Filesystem, Promise<Generate_Types_For_File>> = new Map();
	const load_generate_types = (fs: Filesystem): Promise<Generate_Types_For_File> => {
		if (cachedGenerateTypes.has(fs)) return cachedGenerateTypes.get(fs)!;
		const promise = to_generate_types_for_file(fs);
		cachedGenerateTypes.set(fs, promise);
		return promise;
	};

	const build: EsbuildBuilder['build'] = async (
		source,
		build_config,
		{build_dir, dev, sourcemap, types, target, fs},
	) => {
		if (source.encoding !== 'utf8') {
			throw Error(`esbuild only handles utf8 encoding, not ${source.encoding}`);
		}
		if (source.extension !== TS_EXTENSION) {
			throw Error(`esbuild only handles ${TS_EXTENSION} files, not ${source.extension}`);
		}
		const outDir = to_build_out_path(dev, build_config.name, source.dir_base_path, build_dir);
		const esbuildOptions = {
			...getEsbuildOptions(target, dev, sourcemap),
			sourcefile: source.id,
		};
		const output = await esbuild.transform(source.content, esbuildOptions);
		const jsFilename = replace_extension(source.filename, JS_EXTENSION);
		const jsId = `${outDir}${jsFilename}`;

		// TODO
		// const {content, dependencies_by_build_id} = await postprocess(
		// 	dir,
		// 	extension,
		// 	encoding,
		// 	original_content,
		// 	build_config,
		// 	ctx,
		// 	result,
		// 	source_file,
		// );

		const build_files: Build_File[] = [
			{
				type: 'build',
				source_id: source.id,
				build_config,
				dependencies_by_build_id: null, // TODO
				id: jsId,
				filename: jsFilename,
				dir: outDir,
				extension: JS_EXTENSION,
				encoding: source.encoding,
				content: output.map
					? add_js_sourcemap_footer(output.code, jsFilename + SOURCEMAP_EXTENSION)
					: output.code,
				content_buffer: undefined,
				content_hash: undefined,
				stats: undefined,
				mime_type: undefined,
			},
		];
		if (output.map) {
			build_files.push({
				type: 'build',
				source_id: source.id,
				build_config,
				dependencies_by_build_id: null, // TODO
				id: jsId + SOURCEMAP_EXTENSION,
				filename: jsFilename + SOURCEMAP_EXTENSION,
				dir: outDir,
				extension: SOURCEMAP_EXTENSION,
				encoding: source.encoding,
				content: output.map,
				content_buffer: undefined,
				content_hash: undefined,
				stats: undefined,
				mime_type: undefined,
			});
		}
		if (types) {
			const {types, typemap} = await (await load_generate_types(fs))(source.id);
			build_files.push({
				type: 'build',
				source_id: source.id,
				build_config,
				dependencies_by_build_id: null, // TODO
				id: replace_extension(jsId, TS_TYPE_EXTENSION),
				filename: replace_extension(jsFilename, TS_TYPE_EXTENSION),
				dir: outDir,
				extension: TS_TYPE_EXTENSION,
				encoding: source.encoding,
				content: types,
				content_buffer: undefined,
				content_hash: undefined,
				stats: undefined,
				mime_type: undefined,
			});
			if (typemap !== undefined) {
				build_files.push({
					type: 'build',
					source_id: source.id,
					build_config,
					dependencies_by_build_id: null, // TODO
					id: replace_extension(jsId, TS_TYPEMAP_EXTENSION),
					filename: replace_extension(jsFilename, TS_TYPEMAP_EXTENSION),
					dir: outDir,
					extension: TS_TYPEMAP_EXTENSION,
					encoding: source.encoding,
					content: typemap,
					content_buffer: undefined,
					content_hash: undefined,
					stats: undefined,
					mime_type: undefined,
				});
			}
		}
		return build_files;
	};

	return {name: '@feltcoop/gro_builder_esbuild', build};
};

type Create_Esbuild_Options = (
	dev: boolean,
	target: Ecma_Script_Target,
	sourcemap: boolean,
) => esbuild.TransformOptions;

const create_default_esbuild_options: Create_Esbuild_Options = (dev, target, sourcemap) =>
	to_default_esbuild_options(dev, target, sourcemap);
