import type * as esbuild from 'esbuild';
import {compile, preprocess, type CompileOptions, type PreprocessorGroup} from 'svelte/compiler';
import {readFile} from 'node:fs/promises';
import {relative} from 'node:path';
import {cwd} from 'node:process';

export interface Options {
	dir?: string;
	// These `svelte_` prefixes are unnecessary and verbose
	// but they align with the upstream APIs,
	// so it's simpler overall like for project-wide searching.
	svelte_compile_options?: CompileOptions;
	svelte_preprocessors?: PreprocessorGroup | PreprocessorGroup[];
}

export const esbuild_plugin_svelte = ({
	dir = cwd(),
	svelte_compile_options,
	svelte_preprocessors,
}: Options): esbuild.Plugin => ({
	name: 'svelte',
	setup: (build) => {
		build.onLoad({filter: /\.svelte$/u}, async ({path}) => {
			let source = await readFile(path, 'utf8');
			try {
				const filename = relative(dir, path);
				const preprocessed = svelte_preprocessors
					? await preprocess(source, svelte_preprocessors, {filename})
					: null;
				// TODO handle preprocessor sourcemaps, same as in loader - merge?
				if (preprocessed?.code) source = preprocessed?.code;
				const {js, warnings} = compile(source, svelte_compile_options);
				const contents = js.map ? js.code + '//# sourceMappingURL=' + js.map.toUrl() : js.code;
				return {
					contents,
					warnings: warnings.map((w) => to_sveltekit_message(filename, source, w)),
				};
			} catch (err) {
				return {errors: [to_sveltekit_message(path, source, err)]};
			}
		});
	},
});

/**
 * Following the example in the esbuild docs:
 * https://esbuild.github.io/plugins/#svelte-plugin
 */
const to_sveltekit_message = (
	path: string,
	source: string,
	{message, start, end}: SvelteError,
): esbuild.PartialMessage => {
	let location: esbuild.PartialMessage['location'] = null;
	if (start && end) {
		const lineText = source.split(/\r\n|\r|\n/gu)[start.line - 1];
		const lineEnd = start.line === end.line ? end.column : lineText.length;
		location = {
			file: path,
			line: start.line,
			lineText,
			column: start.column,
			length: lineEnd - start.column,
		};
	}
	return {text: message, location};
};

// these are not exported by Svelte
interface SvelteError {
	message: string;
	start?: LineInfo;
	end?: LineInfo;
}
interface LineInfo {
	line: number;
	column: number;
}
