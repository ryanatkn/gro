import * as svelte from 'svelte/compiler';
import type {PreprocessorGroup} from 'svelte/types/compiler/preprocess';
import type {CompileOptions as SvelteCompileOptions} from 'svelte/types/compiler/interfaces';
import type {Plugin} from 'rollup';
import {createFilter} from '@rollup/pluginutils';

import {magenta, red} from '../utils/terminal.js';
import {toPathStem} from '../utils/path.js';
import {SystemLogger} from '../utils/log.js';
import {printPath} from '../utils/print.js';
import type {GroCssBuild} from './types.js';
import {omitUndefined} from '../utils/object.js';
import {
	SvelteCompilation,
	baseSvelteCompileOptions,
	handleWarn,
	handleStats,
} from '../build/svelteBuildHelpers.js';
import {CSS_EXTENSION} from '../paths.js';

// TODO support `package.json` "svelte" field
// see reference here https://github.com/rollup/rollup-plugin-svelte/blob/master/index.js#L190

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
	compileOptions: SvelteCompileOptions;
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

	const getCompilation = (id: string): GroSvelteCompilation | undefined => compilations.get(id);

	const filter = createFilter(include, exclude);

	return {
		name,
		getCompilation,
		async transform(code, id) {
			if (!filter(id)) return null;
			log.trace('transform', printPath(id));

			let preprocessedCode = code;

			// TODO see rollup-plugin-svelte for how to track deps
			// let dependencies = [];
			if (preprocessor) {
				log.trace('preprocess', printPath(id));
				const preprocessed = await svelte.preprocess(code, preprocessor, {
					filename: id,
				});
				preprocessedCode = preprocessed.code;
				// dependencies = preprocessed.dependencies;
			}

			log.trace('compile', printPath(id));
			let svelteCompilation: SvelteCompilation;
			try {
				svelteCompilation = svelte.compile(preprocessedCode, {
					...baseSvelteCompileOptions,
					dev,
					...compileOptions,
					filename: id,
					name: toPathStem(id),
				});
			} catch (err) {
				log.error(red('Failed to compile Svelte'), printPath(id));
				throw err;
			}
			const {js, css, warnings, stats} = svelteCompilation;

			for (const warning of warnings) {
				onwarn(id, warning, handleWarn, log, this);
			}

			onstats(id, stats, handleStats, log, this);

			const cssId = `${id}${CSS_EXTENSION}`;
			log.trace('add css import', printPath(cssId));
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
