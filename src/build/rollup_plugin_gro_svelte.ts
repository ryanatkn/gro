import * as svelte from 'svelte/compiler';
import type {PreprocessorGroup as Svelte_Preprocessor_Group} from 'svelte/types/compiler/preprocess';
import type {CompileOptions as Svelte_Compile_Options} from 'svelte/types/compiler/interfaces';
import type {Plugin as Rollup_Plugin} from 'rollup';
import {createFilter} from '@rollup/pluginutils';
import {red} from '@feltcoop/felt/util/terminal.js';
import {to_path_stem} from '@feltcoop/felt/util/path.js';
import {print_log_label, System_Logger} from '@feltcoop/felt/util/log.js';
import {omit_undefined} from '@feltcoop/felt/util/object.js';
import type {Partial_Except} from '@feltcoop/felt/util/types.js';

import {
	base_svelte_compile_options,
	handle_warn,
	handle_stats,
} from '../build/svelte_build_helpers.js';
import type {Svelte_Compilation} from '../build/svelte_build_helpers.js';
import {CSS_EXTENSION, print_path} from '../paths.js';
import type {Gro_Css_Build} from './gro_css_build.js';

// TODO support `package.json` "svelte" field
// see reference here https://github.com/rollup/rollup-plugin-svelte/blob/master/index.js#L190

export type Gro_Svelte_Compilation = Svelte_Compilation & {
	id: string;
	css_id: string | undefined;
	code: string; // may be preprocessed or equal to `original_code`
	original_code: string;
};

export interface Options {
	dev: boolean;
	add_css_build(build: Gro_Css_Build): boolean;
	include: string | RegExp | (string | RegExp)[] | null;
	exclude: string | RegExp | (string | RegExp)[] | null;
	preprocessor: Svelte_Preprocessor_Group | Svelte_Preprocessor_Group[] | null;
	compile_options: Svelte_Compile_Options;
	compilations: Map<string, Gro_Svelte_Compilation>;
	onwarn: typeof handle_warn;
	onstats: typeof handle_stats;
}
export type Required_Options = 'dev' | 'add_css_build';
export type Initial_Options = Partial_Except<Options, Required_Options>;
export const init_options = (opts: Initial_Options): Options => ({
	include: '**/*.svelte',
	exclude: null,
	preprocessor: null,
	compile_options: {},
	compilations: new Map<string, Gro_Svelte_Compilation>(),
	onwarn: handle_warn,
	onstats: handle_stats,
	...omit_undefined(opts),
});

export interface Gro_Svelte_Plugin extends Rollup_Plugin {
	get_compilation: (id: string) => Gro_Svelte_Compilation | undefined;
}

export const name = '@feltcoop/rollup_plugin_gro_svelte';

export const rollup_plugin_gro_svelte = (opts: Initial_Options): Gro_Svelte_Plugin => {
	const {
		dev,
		add_css_build,
		include,
		exclude,
		preprocessor,
		compile_options,
		compilations,
		onwarn,
		onstats,
	} = init_options(opts);

	const log = new System_Logger(print_log_label(name));

	const get_compilation = (id: string): Gro_Svelte_Compilation | undefined => compilations.get(id);

	const filter = createFilter(include, exclude);

	return {
		name,
		get_compilation,
		async transform(code, id) {
			if (!filter(id)) return null;
			log.trace('transform', print_path(id));

			let preprocessed_code = code;

			// TODO see rollup-plugin-svelte for how to track deps
			// let dependencies = [];
			if (preprocessor) {
				log.trace('preprocess', print_path(id));
				const preprocessed = await svelte.preprocess(code, preprocessor, {
					filename: id,
				});
				preprocessed_code = preprocessed.code;
				// dependencies = preprocessed.dependencies;
			}

			log.trace('compile', print_path(id));
			let svelte_compilation: Svelte_Compilation;
			try {
				svelte_compilation = svelte.compile(preprocessed_code, {
					...base_svelte_compile_options,
					dev,
					...compile_options,
					filename: id,
					name: to_path_stem(id),
				});
			} catch (err) {
				log.error(red('Failed to compile Svelte'), print_path(id));
				throw err;
			}
			const {js, css, warnings, stats} = svelte_compilation;

			for (const warning of warnings) {
				onwarn(id, warning, handle_warn, log, this);
			}

			onstats(id, stats, handle_stats, log, this);

			const css_id = `${id}${CSS_EXTENSION}`;
			log.trace('add css import', print_path(css_id));
			add_css_build({
				id: css_id,
				source_id: id,
				sort_index: -1,
				...css,
			});

			// save the compilation so other plugins can use it
			const compilation: Gro_Svelte_Compilation = {
				...svelte_compilation,
				id,
				css_id,
				code: preprocessed_code,
				original_code: code,
			};
			compilations.set(id, compilation);

			return js;
			// TODO why doesn't returning the ast work? it'd save a lot of work in rollup, right?
			// try again? https://github.com/rollup/rollup/issues/1371#issuecomment-306002605
			// return {
			//   	...js,
			//   ast,
			//   ast: ast.instance && ast.instance.content,
			// };
		},
	};
};
