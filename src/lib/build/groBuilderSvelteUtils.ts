import type {compile} from 'svelte/compiler';
import * as svelte from 'svelte/compiler';
import type {
	CompileOptions as SvelteCompileOptions,
	Warning as SvelteWarning,
} from 'svelte/types/compiler/interfaces';
import type {PreprocessorGroup, Processed} from 'svelte/types/compiler/preprocess';
import * as sveltePreprocessEsbuild from 'svelte-preprocess-esbuild';
import type {Logger} from '@feltjs/util/log.js';
import {yellow} from 'kleur/colors';
import {printKeyValue, printMs} from '@feltjs/util/print.js';

import {toDefaultEsbuildPreprocessOptions} from './groBuilderEsbuildUtils.js';
import type {EcmaScriptTarget} from './typescriptUtils.js';
import {printPath} from '../path/paths.js';

export type CreatePreprocessor = (
	dev: boolean,
	target: EcmaScriptTarget,
	sourcemap: boolean,
) => PreprocessorGroup | PreprocessorGroup[] | null;

export const createDefaultPreprocessor: CreatePreprocessor = (dev, target, sourcemap) =>
	sveltePreprocessEsbuild.typescript(toDefaultEsbuildPreprocessOptions(dev, target, sourcemap));

// TODO type could be improved, not sure how tho
export interface SvelteCompileStats {
	timings: {
		total: number;
		parse?: {total: number};
		'create component'?: {total: number};
	};
}
// TODO type belongs upstream - augmented for better safety
export type SvelteCompilation = ReturnType<typeof compile>;

export const baseSvelteCompileOptions: SvelteCompileOptions = {
	immutable: true,
	css: 'external',
};

// TODO make this more generic than tied to Svelte?
export const handleWarn = (
	id: string,
	warning: SvelteWarning,
	_handleWarn: (id: string, warning: SvelteWarning, ...args: any[]) => void,
	log: Logger,
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
): void => {
	log.debug(
		printKeyValue('stats', printPath(id)),
		...[
			printKeyValue('total', printMs(stats.timings.total)),
			stats.timings.parse && printKeyValue('parse', printMs(stats.timings.parse.total)),
			stats.timings['create component'] &&
				printKeyValue('create', printMs(stats.timings['create component'].total)),
		].filter(Boolean),
	);
};

let dependencyPreprocessor: PreprocessorGroup | undefined = undefined;

// Extracts a single JS string from Svelte source code for the purpose of parsing its dependencies.
// This is needed for cases where we build Svelte unmodified but still need its dependencies.
// TODO could remove this if we do postprocessing inside the builders
// TODO to support custom preprocessors, we could refactor this to save wasted work
export const extractJsFromSvelteForDependencies = async (
	content: string,
): Promise<{processed: Processed; js: string}> => {
	let js = '';
	if (dependencyPreprocessor === undefined) {
		dependencyPreprocessor = sveltePreprocessEsbuild.typescript(
			toDefaultEsbuildPreprocessOptions(true, 'esnext', false),
		);
	}
	const processed = await svelte.preprocess(content, [
		dependencyPreprocessor,
		// Extract the JS but return nothing, passing through `processed`.
		{
			script(options) {
				// Handle multiple script tags, e.g. for `context="module"`.
				js += `\n${options.content}`;
			},
		},
	]);
	return {processed, js};
};
