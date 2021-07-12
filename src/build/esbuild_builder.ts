import esbuild from 'esbuild';
import {System_Logger, print_log_label} from '@feltcoop/felt/util/log.js';
import type {Logger} from '@feltcoop/felt/util/log.js';
import {omit_undefined} from '@feltcoop/felt/util/object.js';
import {replace_extension} from '@feltcoop/felt/util/path.js';
import {cyan} from '@feltcoop/felt/util/terminal.js';

import type {Ecma_Script_Target, Generate_Types_For_File} from 'src/build/ts_build_helpers.js';
import {to_default_esbuild_options} from './esbuild_build_helpers.js';
import {
	JS_EXTENSION,
	SOURCEMAP_EXTENSION,
	to_build_out_path,
	TS_TYPE_EXTENSION,
	TS_EXTENSION,
	TS_TYPEMAP_EXTENSION,
} from '../paths.js';
import type {Builder, Text_Build_Source} from 'src/build/builder.js';
import {add_js_sourcemap_footer} from './utils.js';
import {to_generate_types_for_file} from './ts_build_helpers.js';
import type {Filesystem} from 'src/fs/filesystem.js';
import type {Build_File} from 'src/build/build_file.js';
import {postprocess} from './postprocess.js';

export interface Options {
	log: Logger;
	// TODO changes to this by consumers can break caching - how can the DX be improved?
	create_esbuild_options: Create_Esbuild_Options;
}
export type Initial_Options = Partial<Options>;
export const init_options = (opts: Initial_Options): Options => {
	return {
		create_esbuild_options: create_default_esbuild_options,
		...omit_undefined(opts),
		log: opts.log || new System_Logger(print_log_label('esbuild_builder', cyan)),
	};
};

type Esbuild_Builder = Builder<Text_Build_Source>;

export const create_esbuild_builder = (opts: Initial_Options = {}): Esbuild_Builder => {
	const {create_esbuild_options} = init_options(opts);

	const esbuild_options_cache: Map<string, esbuild.TransformOptions> = new Map();
	const get_esbuild_options = (
		target: Ecma_Script_Target,
		dev: boolean,
		sourcemap: boolean,
	): esbuild.TransformOptions => {
		const key = sourcemap + target;
		const existing_esbuild_options = esbuild_options_cache.get(key);
		if (existing_esbuild_options !== undefined) return existing_esbuild_options;
		const new_esbuild_options = create_esbuild_options(dev, target, sourcemap);
		esbuild_options_cache.set(key, new_esbuild_options);
		return new_esbuild_options;
	};

	let cached_generate_types: Map<Filesystem, Promise<Generate_Types_For_File>> = new Map();
	const load_generate_types = (fs: Filesystem): Promise<Generate_Types_For_File> => {
		if (cached_generate_types.has(fs)) return cached_generate_types.get(fs)!;
		const promise = to_generate_types_for_file(fs);
		cached_generate_types.set(fs, promise);
		return promise;
	};

	const build: Esbuild_Builder['build'] = async (source, build_config, ctx) => {
		const {build_dir, dev, sourcemap, types, target, fs} = ctx;

		if (source.encoding !== 'utf8') {
			throw Error(`esbuild only handles utf8 encoding, not ${source.encoding}`);
		}
		if (source.extension !== TS_EXTENSION) {
			throw Error(`esbuild only handles ${TS_EXTENSION} files, not ${source.extension}`);
		}

		const out_dir = to_build_out_path(dev, build_config.name, source.dir_base_path, build_dir);
		const esbuild_options = {
			...get_esbuild_options(target, dev, sourcemap),
			sourcefile: source.id,
		};
		const output = await esbuild.transform(source.content, esbuild_options);
		const js_filename = replace_extension(source.filename, JS_EXTENSION);
		const js_id = `${out_dir}${js_filename}`;

		const build_files: Build_File[] = [
			{
				type: 'build',
				source_id: source.id,
				build_config,
				dependencies_by_build_id: null,
				id: js_id,
				filename: js_filename,
				dir: out_dir,
				extension: JS_EXTENSION,
				encoding: source.encoding,
				content: output.map
					? add_js_sourcemap_footer(output.code, js_filename + SOURCEMAP_EXTENSION)
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
				dependencies_by_build_id: null,
				id: js_id + SOURCEMAP_EXTENSION,
				filename: js_filename + SOURCEMAP_EXTENSION,
				dir: out_dir,
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
				dependencies_by_build_id: null,
				id: replace_extension(js_id, TS_TYPE_EXTENSION),
				filename: replace_extension(js_filename, TS_TYPE_EXTENSION),
				dir: out_dir,
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
					dependencies_by_build_id: null,
					id: replace_extension(js_id, TS_TYPEMAP_EXTENSION),
					filename: replace_extension(js_filename, TS_TYPEMAP_EXTENSION),
					dir: out_dir,
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

		return Promise.all(
			build_files.map((build_file) => postprocess(build_file, ctx, build_files, source)),
		);
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
