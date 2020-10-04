import swc from '@swc/core';
import {PreprocessorGroup} from 'svelte/types/compiler/preprocess';

import {magenta, red} from '../colors/terminal.js';
import {Logger, SystemLogger} from '../utils/log.js';
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
	log: Logger;
}
export type RequiredOptions = 'swcOptions';
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => ({
	...omitUndefined(opts),
	langs: opts.langs || ['typescript', 'ts'],
	log: opts.log || new SystemLogger([magenta(`[${name}]`)]),
});

const name = 'svelte-preprocess-swc';

export const sveltePreprocessSwc = (opts: InitialOptions): PreprocessorGroup => {
	const {swcOptions, langs, log} = initOptions(opts);

	return {
		async script({content, attributes, filename}) {
			const {lang} = attributes;
			if (lang && !langs.includes(lang as string)) {
				return null as any; // type is wrong
			}
			// log.trace('transpiling with swc', printPath(filename || ''));
			let output: swc.Output;
			try {
				// TODO do we need to add `filename` to `swcOptions` for source maps?
				// currently not seeing a difference in the output
				output = await swc.transform(content, swcOptions);
			} catch (err) {
				log.error(red('Failed to transpile TypeScript'), printPath(filename || ''));
				throw err;
			}
			return output;
		},
	};
};
