import * as svelte from 'svelte/compiler';
import type {PreprocessorGroup as Svelte_Preprocessor_Group} from 'svelte/types/compiler/preprocess';
import type {CompileOptions as Svelte_Compile_Options} from 'svelte/types/compiler/interfaces';
import {print_log_label, System_Logger} from '@feltcoop/felt/util/log.js';
import type {Logger} from '@feltcoop/felt/util/log.js';
import {omit_undefined} from '@feltcoop/felt/util/object.js';
import {Unreachable_Error} from '@feltcoop/felt/util/error.js';
import {cyan} from '@feltcoop/felt/util/terminal.js';

import type {Ecma_Script_Target} from './ts_build_helpers.js';
import {
	base_svelte_compile_options,
	create_default_preprocessor,
	handle_stats,
	handle_warn,
} from './svelte_build_helpers.js';
import type {Create_Preprocessor, Svelte_Compilation} from './svelte_build_helpers.js';
import {
	CSS_EXTENSION,
	JS_EXTENSION,
	SOURCEMAP_EXTENSION,
	SVELTE_EXTENSION,
	to_build_out_path,
} from '../paths.js';
import type {Builder, Build_Result, Text_Build, Text_Build_Source} from './builder.js';
import type {Build_Config} from '../build/build_config.js';
import {add_css_sourcemap_footer, add_js_sourcemap_footer} from './utils.js';

// TODO build types in production unless `declarations` is `false`,
// so they'll be automatically copied into unbundled production dists

export interface Options {
	log: Logger;
	// TODO changes to this by consumers can break caching - how can the DX be improved?
	create_preprocessor: Create_Preprocessor;
	// TODO how to support options like this without screwing up caching?
	// maybe compilers need a way to declare their options so they (or a hash) can be cached?
	svelte_compile_options: Svelte_Compile_Options;
	onwarn: typeof handle_warn;
	onstats: typeof handle_stats | null;
}
export type Initial_Options = Partial<Options>;
export const init_options = (opts: Initial_Options): Options => {
	return {
		onwarn: handle_warn,
		onstats: null,
		create_preprocessor: create_default_preprocessor,
		...omit_undefined(opts),
		log: opts.log || new System_Logger(print_log_label('svelte_builder', cyan)),
		svelte_compile_options: opts.svelte_compile_options || {},
	};
};

type SvelteBuilder = Builder<Text_Build_Source, Text_Build>;

export const create_svelte_builder = (opts: Initial_Options = {}): SvelteBuilder => {
	const {log, create_preprocessor, svelte_compile_options, onwarn, onstats} = init_options(opts);

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

	const build: SvelteBuilder['build'] = async (
		source,
		build_config,
		{build_dir, dev, sourcemap, target},
	) => {
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
			const svelte_id = `${out_dir}${source.filename}`;
			const result: Build_Result<Text_Build> = {
				builds: [
					{
						id: svelte_id,
						filename: source.filename,
						dir: out_dir,
						extension: SVELTE_EXTENSION,
						encoding,
						content: source.content,
						build_config,
					},
				],
			};
			return result;
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

		const builds: Text_Build[] = [
			{
				id: js_id,
				filename: js_filename,
				dir: out_dir,
				extension: JS_EXTENSION,
				encoding,
				content: has_js_sourcemap
					? add_js_sourcemap_footer(js.code, js_filename + SOURCEMAP_EXTENSION)
					: js.code,
				build_config,
			},
		];
		if (has_js_sourcemap) {
			builds.push({
				id: js_id + SOURCEMAP_EXTENSION,
				filename: js_filename + SOURCEMAP_EXTENSION,
				dir: out_dir,
				extension: SOURCEMAP_EXTENSION,
				encoding,
				content: JSON.stringify(js.map), // TODO do we want to also store the object version?
				build_config,
			});
		}
		if (css.code) {
			builds.push({
				id: css_id,
				filename: css_filename,
				dir: out_dir,
				extension: CSS_EXTENSION,
				encoding,
				content: has_css_sourcemap
					? add_css_sourcemap_footer(css.code, css_filename + SOURCEMAP_EXTENSION)
					: css.code,
				build_config,
			});
			if (has_css_sourcemap) {
				builds.push({
					id: css_id + SOURCEMAP_EXTENSION,
					filename: css_filename + SOURCEMAP_EXTENSION,
					dir: out_dir,
					extension: SOURCEMAP_EXTENSION,
					encoding,
					content: JSON.stringify(css.map), // TODO do we want to also store the object version?
					build_config,
				});
			}
		}
		const result: Build_Result<Text_Build> = {builds};
		return result;
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
