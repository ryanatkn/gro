import * as svelte from 'svelte/compiler';
import type {PreprocessorGroup as Svelte_Preprocessor_Group} from 'svelte/types/compiler/preprocess';
import type {CompileOptions as Svelte_Compile_Options} from 'svelte/types/compiler/interfaces';
import {print_log_label, System_Logger} from '@feltcoop/felt/util/log.js';
import type {Logger} from '@feltcoop/felt/util/log.js';
import {Unreachable_Error} from '@feltcoop/felt/util/error.js';
import {cyan} from '@feltcoop/felt/util/terminal.js';

import type {Ecma_Script_Target} from 'src/build/typescript_utils.js';
import {
	base_svelte_compile_options,
	create_default_preprocessor,
	handle_stats,
	handle_warn,
} from './gro_builder_svelte_utils.js';
import type {Create_Preprocessor, Svelte_Compilation} from 'src/build/gro_builder_svelte_utils.js';
import {
	CSS_EXTENSION,
	JS_EXTENSION,
	SOURCEMAP_EXTENSION,
	SVELTE_EXTENSION,
	to_build_out_path,
} from '../paths.js';
import type {Builder, Text_Build_Source} from 'src/build/builder.js';
import type {Build_Config} from 'src/build/build_config.js';
import {add_css_sourcemap_footer, add_js_sourcemap_footer} from './utils.js';
import type {Build_File} from 'src/build/build_file.js';
import {postprocess} from './postprocess.js';

// TODO build types in production unless `declarations` is `false`,
// so they'll be automatically copied into unbundled production dists

export interface Options {
	log?: Logger;
	// TODO changes to this by consumers can break caching - how can the DX be improved?
	create_preprocessor?: Create_Preprocessor;
	// TODO how to support options like this without screwing up caching?
	// maybe compilers need a way to declare their options so they (or a hash) can be cached?
	svelte_compile_options?: Svelte_Compile_Options;
	onwarn?: typeof handle_warn;
	onstats?: typeof handle_stats | null;
}

type Svelte_Builder = Builder<Text_Build_Source>;

export const gro_builder_svelte = (options: Options = {}): Svelte_Builder => {
	const {
		log = new System_Logger(print_log_label('svelte_builder', cyan)),
		create_preprocessor = create_default_preprocessor,
		svelte_compile_options,
		onwarn = handle_warn,
		onstats = null,
	} = options;

	const preprocessor_cache: Map<
		string,
		Svelte_Preprocessor_Group | Svelte_Preprocessor_Group[] | null
	> = new Map();
	const get_preprocessor = (
		target: Ecma_Script_Target,
		dev: boolean,
		sourcemap: boolean,
	): Svelte_Preprocessor_Group | Svelte_Preprocessor_Group[] | null => {
		const key = sourcemap + target;
		const existing_preprocessor = preprocessor_cache.get(key);
		if (existing_preprocessor !== undefined) return existing_preprocessor;
		const new_preprocessor = create_preprocessor(dev, target, sourcemap);
		preprocessor_cache.set(key, new_preprocessor);
		return new_preprocessor;
	};

	const build: Svelte_Builder['build'] = async (source, build_config, ctx) => {
		const {build_dir, dev, sourcemap, target} = ctx;

		if (source.encoding !== 'utf8') {
			throw Error(`svelte only handles utf8 encoding, not ${source.encoding}`);
		}
		if (source.extension !== SVELTE_EXTENSION) {
			throw Error(`svelte only handles ${SVELTE_EXTENSION} files, not ${source.extension}`);
		}

		const {id, encoding, content} = source;
		const out_dir = to_build_out_path(dev, build_config.name, source.dir_base_path, build_dir);

		// for production builds, output uncompiled Svelte
		// TODO what about non-TypeScript preprocessors?
		if (!dev) {
			const build_files: Build_File[] = [
				{
					type: 'build',
					source_id: source.id,
					build_config,
					dependencies: null,
					id: `${out_dir}${source.filename}`,
					filename: source.filename,
					dir: out_dir,
					extension: SVELTE_EXTENSION,
					encoding,
					content: source.content,
					content_buffer: undefined,
					content_hash: undefined,
					stats: undefined,
					mime_type: undefined,
				},
			];
			await Promise.all(
				build_files.map((build_file) => postprocess(build_file, ctx, build_files, source)),
			);
			return build_files;
		}

		let preprocessed_code: string;

		// TODO see rollup-plugin-svelte for how to track deps
		// let dependencies = [];
		const preprocessor = get_preprocessor(target, dev, sourcemap);
		if (preprocessor !== null) {
			const preprocessed = await svelte.preprocess(content, preprocessor, {filename: id});
			preprocessed_code = preprocessed.code;
			// dependencies = preprocessed.dependencies; // TODO
		} else {
			preprocessed_code = content;
		}

		const output: Svelte_Compilation = svelte.compile(preprocessed_code, {
			...base_svelte_compile_options,
			dev,
			generate: get_generate_option(build_config),
			...svelte_compile_options,
			filename: id, // TODO should we be giving a different path?
		});
		const {js, css, warnings, stats} = output;

		for (const warning of warnings) {
			onwarn(id, warning, handle_warn, log);
		}
		if (onstats) onstats(id, stats, handle_stats, log);

		const js_filename = `${source.filename}${JS_EXTENSION}`;
		const css_filename = `${source.filename}${CSS_EXTENSION}`;
		const js_id = `${out_dir}${js_filename}`;
		const css_id = `${out_dir}${css_filename}`;
		const has_js_sourcemap = sourcemap && js.map !== undefined;
		const has_css_sourcemap = sourcemap && css.map !== undefined;

		const build_files: Build_File[] = [
			{
				type: 'build',
				source_id: source.id,
				build_config,
				dependencies: null,
				id: js_id,
				filename: js_filename,
				dir: out_dir,
				extension: JS_EXTENSION,
				encoding,
				content: has_js_sourcemap
					? add_js_sourcemap_footer(js.code, js_filename + SOURCEMAP_EXTENSION)
					: js.code,
				content_buffer: undefined,
				content_hash: undefined,
				stats: undefined,
				mime_type: undefined,
			},
		];
		if (has_js_sourcemap) {
			build_files.push({
				type: 'build',
				source_id: source.id,
				build_config,
				dependencies: null,
				id: js_id + SOURCEMAP_EXTENSION,
				filename: js_filename + SOURCEMAP_EXTENSION,
				dir: out_dir,
				extension: SOURCEMAP_EXTENSION,
				encoding,
				content: JSON.stringify(js.map), // TODO do we want to also store the object version?
				content_buffer: undefined,
				content_hash: undefined,
				stats: undefined,
				mime_type: undefined,
			});
		}
		if (css.code) {
			build_files.push({
				type: 'build',
				source_id: source.id,
				build_config,
				dependencies: null,
				id: css_id,
				filename: css_filename,
				dir: out_dir,
				extension: CSS_EXTENSION,
				encoding,
				content: has_css_sourcemap
					? add_css_sourcemap_footer(css.code, css_filename + SOURCEMAP_EXTENSION)
					: css.code,
				content_buffer: undefined,
				content_hash: undefined,
				stats: undefined,
				mime_type: undefined,
			});
			if (has_css_sourcemap) {
				build_files.push({
					type: 'build',
					source_id: source.id,
					build_config,
					dependencies: null,
					id: css_id + SOURCEMAP_EXTENSION,
					filename: css_filename + SOURCEMAP_EXTENSION,
					dir: out_dir,
					extension: SOURCEMAP_EXTENSION,
					encoding,
					content: JSON.stringify(css.map), // TODO do we want to also store the object version?
					content_buffer: undefined,
					content_hash: undefined,
					stats: undefined,
					mime_type: undefined,
				});
			}
		}

		await Promise.all(
			build_files.map((build_file) => postprocess(build_file, ctx, build_files, source)),
		);
		return build_files;
	};

	return {name: '@feltcoop/gro_builder_svelte', build};
};

const get_generate_option = (build_config: Build_Config): 'dom' | 'ssr' | false => {
	switch (build_config.platform) {
		case 'browser':
			return 'dom';
		case 'node':
			return 'ssr';
		default:
			throw new Unreachable_Error(build_config.platform);
	}
};
