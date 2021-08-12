import type {ExistingRawSourceMap, PluginContext} from 'rollup';
import type {compile} from 'svelte/compiler';
import * as svelte from 'svelte/compiler';
import type {
	CompileOptions as SvelteCompileOptions,
	Warning as SvelteWarning,
} from 'svelte/types/compiler/interfaces';
import type {PreprocessorGroup} from 'svelte/types/compiler/preprocess';
import * as svelte_preprocess_esbuild from 'svelte-preprocess-esbuild';
import type {Logger} from '@feltcoop/felt/util/log.js';
import {yellow} from '@feltcoop/felt/util/terminal.js';
import {print_key_value, print_ms} from '@feltcoop/felt/util/print.js';
import type {Omit_Strict} from '@feltcoop/felt/util/types.js';

import {to_default_esbuild_preprocess_options} from './gro_builder_esbuild_utils.js';
import type {EcmaScriptTarget} from 'src/build/typescript_utils.js';
import {print_path} from '../paths.js';

export type CreatePreprocessor = (
	dev: boolean,
	target: EcmaScriptTarget,
	sourcemap: boolean,
) => PreprocessorGroup | PreprocessorGroup[] | null;

export const create_default_preprocessor: CreatePreprocessor = (dev, target, sourcemap) =>
	svelte_preprocess_esbuild.typescript(
		to_default_esbuild_preprocess_options(dev, target, sourcemap),
	);

// TODO type could be improved, not sure how tho
export interface SvelteCompileStats {
	timings: {
		total: number;
		parse?: {total: number};
		'create component'?: {total: number};
	};
}
// TODO type belongs upstream - augmented for better safety
export type SvelteCompilation = Omit_Strict<ReturnType<typeof compile>, 'js' | 'css' | 'stats'> & {
	js: {
		code: string;
		map: ExistingRawSourceMap | undefined;
	};
	css: {
		code: string | null;
		map: ExistingRawSourceMap | undefined;
	};
	stats: SvelteCompileStats;
};

// Commented-out values are the same as the defaults.
export const base_svelte_compile_options: SvelteCompileOptions = {
	// filename: undefined, // `string` used for debugging hints and sourcemaps. Your bundler plugin will set it automatically.
	// name: 'Component', // `string` that sets the name of the resulting JavaScript class (though the compiler will rename it if it would otherwise conflict with other variables in scope). It will normally be inferred from `filename`.
	// format: 'esm', // If "esm", creates a JavaScript module (with import and export). If "cjs", creates a CommonJS module (with require and module.exports), which is useful in some server-side rendering situations or for testing.
	// generate: 'dom', // If "dom", Svelte emits a JavaScript class for mounting to the DOM. If "ssr", Svelte emits an object with a render method suitable for server-side rendering. If false, no JavaScript or CSS is returned; just metadata.
	// dev: false, // If true, causes extra code to be added to components that will perform runtime checks and provide debugging information during development.
	immutable: true, // If true, tells the compiler that you promise not to mutate any objects. This allows it to be less conservative about checking whether values have changed.
	// hydratable: false, // If true, enables the hydrate: true runtime option, which allows a component to upgrade existing DOM rather than creating new DOM from scratch.
	// legacy: false, // If true, generates code that will work in IE9 and IE10, which don't support things like element.dataset.
	// accessors: false, // If true, getters and setters will be created for the component's props. If false, they will only be created for readonly exported values (i.e. those declared with const, class and function). If compiling with customElement: true this option defaults to true.
	// customElement: false, // If true, tells the compiler to generate a custom element constructor instead of a regular Svelte component.
	// tag: undefined, // A string that tells Svelte what tag name to register the custom element with. It must be a lowercase alphanumeric string with at least one hyphen, e.g. "my-element".
	css: false, // If true, styles will be included in the JavaScript class and injected at runtime. It's recommended that you set this to false and use the CSS that is statically generated, as it will result in smaller JavaScript bundles and better performance.
	// loopGuardTimeout: 0, // A `number` that tells Svelte to break the loop if it blocks the thread for more than `loopGuardTimeout` ms. This is useful to prevent infinite loops. Only available when `dev: true`
	// preserveComments: false, // If true, your HTML comments will be preserved during server-side rendering. By default, they are stripped out.
	// preserveWhitespace: false, // If true, whitespace inside and between elements is kept as you typed it, rather than optimised by Svelte.
	// outputFilename: undefined, // A string used for your JavaScript sourcemap.
	// cssOutputFilename: undefined, // A string used for your CSS sourcemap.
	// sveltePath: 'svelte', //  	The location of the `svelte` package. Any imports from `svelte` or `svelte/[module]` will be modified accordingly.
};

// TODO make this more generic than tied to Svelte?
export const handle_warn = (
	id: string,
	warning: SvelteWarning,
	_handle_warn: (id: string, warning: SvelteWarning, ...args: any[]) => void,
	log: Logger,
	_plugin_ontext?: PluginContext,
): void => {
	const warn_args: any[] = [print_path(id)];
	if (warning.frame) {
		warn_args.push('\n' + warning.frame, '\n', yellow(warning.message));
	} else {
		warn_args.push(warning);
	}
	log.warn(...warn_args);
};

export const handle_stats = (
	id: string,
	stats: SvelteCompileStats,
	_handle_stats: (id: string, stats: SvelteCompileStats, ...args: any[]) => void,
	log: Logger,
	_plugin_ontext?: PluginContext,
): void => {
	log.trace(
		print_key_value('stats', print_path(id)),
		...[
			print_key_value('total', print_ms(stats.timings.total)),
			stats.timings.parse && print_key_value('parse', print_ms(stats.timings.parse.total)),
			stats.timings['create component'] &&
				print_key_value('create', print_ms(stats.timings['create component'].total)),
		].filter(Boolean),
	);
};

let dependency_preprocessor: PreprocessorGroup | undefined = undefined;

// Extracts a single JS string from Svelte source code for the purpose of parsing its dependencies.
// This is needed for cases where we build Svelte unmodified but still need its dependencies.
// TODO could remove this if we do postprocessing inside the builders
// TODO to support custom preprocessors, we could refactor this to save wasted work
export const extract_js_from_svelte_for_dependencies = async (content: string): Promise<string> => {
	let final_content: string | undefined = undefined;
	if (dependency_preprocessor === undefined) {
		dependency_preprocessor = svelte_preprocess_esbuild.typescript(
			to_default_esbuild_preprocess_options(true, 'esnext', false),
		);
	}
	await svelte.preprocess(content, [
		dependency_preprocessor,
		{
			script(options) {
				if (final_content === undefined) {
					final_content = options.content;
				} else {
					final_content += `\n${options.content}`;
				}
				return {code: ''};
			},
		},
	]);
	return final_content || '';
};
