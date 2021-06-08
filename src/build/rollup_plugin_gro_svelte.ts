import * as svelte from 'svelte/compiler';
import type {PreprocessorGroup as Svelte_Preprocessor_Group} from 'svelte/types/compiler/preprocess';
import type {CompileOptions as Svelte_Compile_Options} from 'svelte/types/compiler/interfaces';
import type {Plugin, ExistingRawSourceMap} from 'rollup';
import {createFilter} from '@rollup/pluginutils';
import {red} from '@feltcoop/felt/util/terminal.js';
import {toPathStem} from '@feltcoop/felt/util/path.js';
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
import type {Css_Build} from './cssCache.js';

// TODO support `package.json` "svelte" field
// see reference here https://github.com/rollup/rollup-plugin-svelte/blob/master/index.js#L190

export interface Gro_Css_Build extends Css_Build {
	source_id: string; // for Svelte files, the `.svelte` version instead of `.css`
	sort_index: number; // sort order when css is concatenated - maybe make this optional?
	map: ExistingRawSourceMap | undefined;
}

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

export interface Gro_Svelte_Plugin extends Plugin {
	get_compilation: (id: string) => Gro_Svelte_Compilation | undefined;
}

export const name = 'gro-svelte';

export const groSveltePlugin = (opts: Initial_Options): Gro_Svelte_Plugin => {
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

			let preprocessedCode = code;

			// TODO see rollup-plugin-svelte for how to track deps
			// let dependencies = [];
			if (preprocessor) {
				log.trace('preprocess', print_path(id));
				const preprocessed = await svelte.preprocess(code, preprocessor, {
					filename: id,
				});
				preprocessedCode = preprocessed.code;
				// dependencies = preprocessed.dependencies;
			}

			log.trace('compile', print_path(id));
			let svelteCompilation: Svelte_Compilation;
			try {
				svelteCompilation = svelte.compile(preprocessedCode, {
					...base_svelte_compile_options,
					dev,
					...compile_options,
					filename: id,
					name: toPathStem(id),
				});
			} catch (err) {
				log.error(red('Failed to compile Svelte'), print_path(id));
				throw err;
			}
			const {js, css, warnings, stats} = svelteCompilation;

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
				...svelteCompilation,
				id,
				css_id,
				code: preprocessedCode,
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
