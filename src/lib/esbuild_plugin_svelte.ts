import type * as esbuild from 'esbuild';
import {
	compile,
	compileModule,
	preprocess,
	type CompileOptions,
	type ModuleCompileOptions,
	type PreprocessorGroup,
} from 'svelte/compiler';
import {readFile} from 'node:fs/promises';
import {relative} from 'node:path';

import {SVELTE_MATCHER, SVELTE_RUNES_MATCHER} from './svelte_helpers.js';

export interface Options {
	dir?: string;
	svelte_compile_options?: CompileOptions;
	svelte_compile_module_options?: ModuleCompileOptions;
	svelte_preprocessors?: PreprocessorGroup | PreprocessorGroup[];
}

export const esbuild_plugin_svelte = (options: Options = {}): esbuild.Plugin => {
	const {
		dir = process.cwd(),
		svelte_compile_options = {},
		svelte_compile_module_options = {},
		svelte_preprocessors,
	} = options;
	return {
		name: 'svelte',
		setup: (build) => {
			build.onLoad({filter: SVELTE_RUNES_MATCHER}, async ({path}) => {
				const source = await readFile(path, 'utf8');
				try {
					const filename = relative(dir, path);
					const {js, warnings} = compileModule(source, {
						filename,
						...svelte_compile_module_options,
					});
					const contents = js.map ? js.code + '//# sourceMappingURL=' + js.map.toUrl() : js.code;
					return {
						contents,
						warnings: warnings.map((w) => convert_svelte_message_to_esbuild(filename, source, w)),
					};
				} catch (err) {
					return {errors: [convert_svelte_message_to_esbuild(path, source, err)]};
				}
			});
			build.onLoad({filter: SVELTE_MATCHER}, async ({path}) => {
				let source = await readFile(path, 'utf8');
				try {
					const filename = relative(dir, path);
					const preprocessed = svelte_preprocessors
						? await preprocess(source, svelte_preprocessors, {filename})
						: null;
					// TODO handle preprocessor sourcemaps, same as in loader - merge?
					if (preprocessed?.code) source = preprocessed?.code;
					const {js, warnings} = compile(source, {
						filename,
						...svelte_compile_options,
					});
					const contents = js.map ? js.code + '//# sourceMappingURL=' + js.map.toUrl() : js.code;
					return {
						contents,
						warnings: warnings.map((w) => convert_svelte_message_to_esbuild(filename, source, w)),
					};
				} catch (err) {
					return {errors: [convert_svelte_message_to_esbuild(path, source, err)]};
				}
			});
		},
	};
};

/**
 * Following the example in the esbuild docs:
 * https://esbuild.github.io/plugins/#svelte-plugin
 */
const convert_svelte_message_to_esbuild = (
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
