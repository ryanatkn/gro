import type {ExistingRawSourceMap, PluginContext} from 'rollup';
import type svelte from 'svelte/compiler.js';
import {CompileOptions, Warning} from 'svelte/types/compiler/interfaces';

import {Logger} from '../utils/log.js';
import {yellow} from '../colors/terminal.js';
import {printKeyValue, printMs, printPath} from '../utils/print.js';
import {toRootPath} from '../paths.js';

// TODO type could be improved, not sure how tho
export interface SvelteCompileStats {
	timings: {
		total: number;
		parse?: {total: number};
		'create component'?: {total: number};
	};
}
// TODO type belongs upstream - augmented for better safety
export type SvelteCompilation = OmitStrict<
	ReturnType<typeof svelte.compile>,
	'js' | 'css' | 'stats'
> & {
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
export const baseSvelteCompileOptions: CompileOptions = {
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
export const handleWarn = (
	id: string,
	warning: Warning,
	_handleWarn: (id: string, warning: Warning, ...args: any[]) => void,
	log: Logger,
	_pluginContext?: PluginContext,
): void => {
	const warnArgs: any[] = [printPath(id)];
	if (warning.frame) {
		warnArgs.push('\n' + warning.frame, '\n', yellow(warning.message));
	} else {
		warnArgs.push(warning);
	}
	log.warn(...warnArgs);
};

export const handleStats = (
	id: string,
	stats: SvelteCompileStats,
	_handleStats: (id: string, stats: SvelteCompileStats, ...args: any[]) => void,
	log: Logger,
	_pluginContext?: PluginContext,
): void => {
	log.trace(
		printKeyValue('stats', toRootPath(id)),
		...[
			printKeyValue('total', printMs(stats.timings.total)),
			stats.timings.parse && printKeyValue('parse', printMs(stats.timings.parse.total)),
			stats.timings['create component'] &&
				printKeyValue('create', printMs(stats.timings['create component'].total)),
		].filter(Boolean),
	);
};
