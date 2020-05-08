import svelte from 'svelte/compiler.js';
import {PreprocessorGroup} from 'svelte/types/compiler/preprocess';
import {CompileOptions, Warning} from 'svelte/types/compiler/interfaces';
import {Plugin, PluginContext, ExistingRawSourceMap} from 'rollup';
import rollupPluginutils from '@rollup/pluginutils';
const {createFilter} = rollupPluginutils; // TODO esm

import {magenta, yellow, red} from '../colors/terminal.js';
import {getPathStem, replaceExt} from '../utils/path.js';
import {SystemLogger, Logger} from '../utils/log.js';
import {fmtVal, fmtMs, fmtPath} from '../utils/fmt.js';
import {toRootPath} from '../paths.js';
import {GroCssBuild} from './types.js';
import {omitUndefined} from '../utils/object.js';

// TODO support `package.json` "svelte" field
// see reference here https://github.com/rollup/rollup-plugin-svelte/blob/master/index.js#L190

// TODO type could be improved, not sure how tho
interface Stats {
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
		code: string;
		map: ExistingRawSourceMap | undefined;
	};
	stats: Stats;
};

export type GroSvelteCompilation = SvelteCompilation & {
	id: string;
	cssId: string | undefined;
	code: string; // may be preprocessed or equal to `originalCode`
	originalCode: string;
};

export interface Options {
	dev: boolean;
	addCssBuild(build: GroCssBuild): boolean;
	include: string | RegExp | (string | RegExp)[] | null;
	exclude: string | RegExp | (string | RegExp)[] | null;
	preprocessor: PreprocessorGroup | PreprocessorGroup[] | null;
	compileOptions: CompileOptions;
	compilations: Map<string, GroSvelteCompilation>;
	onwarn: typeof handleWarn;
	onstats: typeof handleStats;
}
export type RequiredOptions = 'dev' | 'addCssBuild';
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => ({
	include: '**/*.svelte',
	exclude: null,
	preprocessor: null,
	compileOptions: {},
	compilations: new Map<string, GroSvelteCompilation>(),
	onwarn: handleWarn,
	onstats: handleStats,
	...omitUndefined(opts),
});

const baseCompileOptions: CompileOptions = {
	format: 'esm', // If "esm", creates a JavaScript module (with import and export). If "cjs", creates a CommonJS module (with require and module.exports), which is useful in some server-side rendering situations or for testing.
	generate: 'dom', // If "dom", Svelte emits a JavaScript class for mounting to the DOM. If "ssr", Svelte emits an object with a render method suitable for server-side rendering. If false, no JavaScript or CSS is returned; just metadata.
	dev: false, // If true, causes extra code to be added to components that will perform runtime checks and provide debugging information during development.
	immutable: false, // If true, tells the compiler that you promise not to mutate any objects. This allows it to be less conservative about checking whether values have changed.
	hydratable: false, // If true, enables the hydrate: true runtime option, which allows a component to upgrade existing DOM rather than creating new DOM from scratch.
	legacy: false, // If true, generates code that will work in IE9 and IE10, which don't support things like element.dataset.
	accessors: false, // If true, getters and setters will be created for the component's props. If false, they will only be created for readonly exported values (i.e. those declared with const, class and function). If compiling with customElement: true this option defaults to true.
	customElement: false, // If true, tells the compiler to generate a custom element constructor instead of a regular Svelte component.
	tag: undefined, // A string that tells Svelte what tag name to register the custom element with. It must be a lowercase alphanumeric string with at least one hyphen, e.g. "my-element".
	css: false, // If true, styles will be included in the JavaScript class and injected at runtime. It's recommended that you set this to false and use the CSS that is statically generated, as it will result in smaller JavaScript bundles and better performance.
	preserveComments: false, // If true, your HTML comments will be preserved during server-side rendering. By default, they are stripped out.
	preserveWhitespace: false, // If true, whitespace inside and between elements is kept as you typed it, rather than optimised by Svelte.
	outputFilename: undefined, // A string used for your JavaScript sourcemap.
	cssOutputFilename: undefined, // A string used for your CSS sourcemap.
};

export interface GroSveltePlugin extends Plugin {
	getCompilation: (id: string) => GroSvelteCompilation | undefined;
}

export const name = 'gro-svelte';

export const groSveltePlugin = (opts: InitialOptions): GroSveltePlugin => {
	const {
		dev,
		addCssBuild,
		include,
		exclude,
		preprocessor,
		compileOptions,
		compilations,
		onwarn,
		onstats,
	} = initOptions(opts);

	const log = new SystemLogger([magenta(`[${name}]`)]);

	const getCompilation = (id: string): GroSvelteCompilation | undefined =>
		compilations.get(id);

	const filter = createFilter(include, exclude);

	return {
		name,
		getCompilation,
		async transform(code, id) {
			if (!filter(id)) return null;
			log.trace('transform', fmtPath(id));

			let preprocessedCode = code;

			// TODO see rollup-plugin-svelte for how to track deps
			// let dependencies = [];
			if (preprocessor) {
				log.trace('preprocess', fmtPath(id));
				const preprocessed = await svelte.preprocess(code, preprocessor, {
					filename: id,
				});
				preprocessedCode = preprocessed.code;
				// dependencies = preprocessed.dependencies;
			}

			log.trace('compile', fmtPath(id));
			let svelteCompilation: SvelteCompilation;
			try {
				svelteCompilation = svelte.compile(preprocessedCode, {
					...baseCompileOptions,
					dev,
					...compileOptions,
					filename: id,
					name: getPathStem(id),
				});
			} catch (err) {
				log.error(red('Failed to compile Svelte'), fmtPath(id));
				throw err;
			}
			const {js, css, warnings, stats} = svelteCompilation;

			for (const warning of warnings) {
				onwarn(id, warning, handleWarn, this, log);
			}

			onstats(id, stats, handleStats, this, log);

			let cssId = replaceExt(id, '.css');
			log.trace('add css import', fmtPath(cssId));
			addCssBuild({
				id: cssId,
				sourceId: id,
				sortIndex: -1,
				...css,
			});

			// save the compilation so other plugins can use it
			const compilation: GroSvelteCompilation = {
				...svelteCompilation,
				id,
				cssId,
				code: preprocessedCode,
				originalCode: code,
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

const handleWarn = (
	id: string,
	warning: Warning,
	_handleWarn: (id: string, warning: Warning, ...args: any[]) => void,
	_pluginContext: PluginContext,
	log: Logger,
): void => {
	const warnArgs: any[] = [id, warning];
	if (typeof warning !== 'string' && warning.frame) {
		warnArgs.push('\n' + warning.frame, '\n', yellow(warning.message));
	}
	log.warn(...warnArgs);
};

const handleStats = (
	id: string,
	stats: Stats,
	_handleStats: (id: string, stats: Stats, ...args: any[]) => void,
	_pluginContext: PluginContext,
	log: Logger,
): void => {
	log.info(
		fmtVal('stats', toRootPath(id)),
		...[
			fmtVal('total', fmtMs(stats.timings.total)),
			stats.timings.parse && fmtVal('parse', fmtMs(stats.timings.parse.total)),
			stats.timings['create component'] &&
				fmtVal('create', fmtMs(stats.timings['create component'].total)),
		].filter(Boolean),
	);
};
