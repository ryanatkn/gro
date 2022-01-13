import * as svelte from 'svelte/compiler';
import type {PreprocessorGroup as SveltePreprocessorGroup} from 'svelte/types/compiler/preprocess';
import type {CompileOptions as SvelteCompileOptions} from 'svelte/types/compiler/interfaces';
import type {Plugin as RollupPlugin} from 'rollup';
import {createFilter} from '@rollup/pluginutils';
import {red} from '@feltcoop/felt/util/terminal.js';
import {toPathStem} from '@feltcoop/felt/util/path.js';
import {printLogLabel, SystemLogger} from '@feltcoop/felt/util/log.js';
import {type Logger} from '@feltcoop/felt/util/log.js';

import {baseSvelteCompileOptions, handleWarn, handleStats} from '../build/groBuilderSvelteUtils.js';
import {type SvelteCompilation} from 'src/build/groBuilderSvelteUtils.js';
import {CSS_EXTENSION, printPath} from '../paths.js';
import {type GroCssBuild} from 'src/build/groCssBuild.js';

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
	include?: string | RegExp | (string | RegExp)[] | null;
	exclude?: string | RegExp | (string | RegExp)[] | null;
	preprocessor?: SveltePreprocessorGroup | SveltePreprocessorGroup[] | null;
	compileOptions?: SvelteCompileOptions;
	compilations?: Map<string, GroSvelteCompilation>;
	log?: Logger;
	onwarn?: typeof handleWarn;
	onstats?: typeof handleStats;
}

export interface GroSveltePlugin extends RollupPlugin {
	getCompilation: (id: string) => GroSvelteCompilation | undefined;
}

export const name = '@feltcoop/rollupPluginGroSvelte';

export const rollupPluginGroSvelte = (options: Options): GroSveltePlugin => {
	const {
		dev,
		addCssBuild,
		include = '**/*.svelte',
		exclude = null,
		preprocessor = null,
		compileOptions = {},
		compilations = new Map<string, GroSvelteCompilation>(),
		log = new SystemLogger(printLogLabel(name)),
		onwarn = handleWarn,
		onstats = handleStats,
	} = options;

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
