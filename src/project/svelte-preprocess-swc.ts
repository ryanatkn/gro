import swc from '@swc/core';
import {PreprocessorGroup} from 'svelte/types/compiler/preprocess';

import {mergeSwcOptions} from '../compile/swcHelpers.js';
import {magenta, red} from '../colors/terminal.js';
import {SystemLogger} from '../utils/log.js';
import {printPath} from '../utils/print.js';
import {omitUndefined} from '../utils/object.js';

/*

This preprocessor transpiles the script portion of Svelte files
if the script tag has a `lang="typescript"` or `lang="ts"` attribute.
No typechecking is performed - that's left for a separate build step.

It uses swc for speeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeed.

TODO use swc's JS parser options if it's not TypeScript for downtranspilation

*/

export interface Options {
	swcOptions: swc.Options;
	langs: string[];
}
export type RequiredOptions = 'swcOptions';
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => ({
	langs: ['typescript', 'ts'],
	...omitUndefined(opts),
});

const name = 'svelte-preprocess-swc';

export const sveltePreprocessSwc = (opts: InitialOptions): PreprocessorGroup => {
	const {swcOptions, langs} = initOptions(opts);

	const log = new SystemLogger([magenta(`[${name}]`)]);

	return {
		script({content, attributes, filename}) {
			const {lang} = attributes;
			if (lang && !langs.includes(lang as string)) {
				return null as any; // type is wrong
			}
			log.info('transpiling with swc', printPath(filename || ''));
			const finalSwcOptions = filename ? mergeSwcOptions(swcOptions, filename) : swcOptions;
			let output: swc.Output;
			try {
				// TODO maybe use the async version so we can preprocess in parallel?
				output = swc.transformSync(content, finalSwcOptions);
			} catch (err) {
				log.error(red('Failed to transpile TypeScript'), printPath(filename || ''));
				throw err;
			}
			return output;
		},
	};
};
