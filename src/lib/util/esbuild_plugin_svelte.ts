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
		console.log('SVELTE SETUP');
		build.onLoad({filter: /\.svelte$/u}, async ({path}) => {
			console.log(`SVELLTE path`, path);
			const source_id = relative(dir, path);
			const raw_source = await readFile(source_id, 'utf8');
			let source: string | undefined;
			console.log(`source_id, source`, source_id, raw_source);
			try {
				const preprocessed = svelte_preprocessors
					? await preprocess(raw_source, svelte_preprocessors, {filename: source_id})
					: null;
				// TODO handle preprocessor sourcemaps
				const source = preprocessed?.code ?? raw_source;

				const {
					js: {code, map},
					warnings,
				} = compile(source, svelte_compile_options);
				const contents = map ? code + '//# sourceMappingURL=' + map.toUrl() : code;
				console.log('COMPILED SVELTE WITH SOURCEMAP', !!map);

				return {
					contents,
					warnings: warnings.map((w) => to_sveltekit_message(source_id, source, w)),
				};
			} catch (err) {
				console.log(`err`, err); // TODO BLOCK replace with svelte type if this has `code` on it - Warning
				if (err.code) {
					console.log('SVELTE YES HAS CODE');
				} else {
					console.log('SVELTE NO CODE');
				}
				return {errors: [to_sveltekit_message(source_id, source ?? raw_source, err)]};
			}
		});
	},
});

/**
 * Following the example in the esbuild docs:
 * https://esbuild.github.io/plugins/#svelte-plugin
 */
const to_sveltekit_message = (
	source_id: string,
	source: string,
	{message, start, end}: SvelteError,
): esbuild.PartialMessage => {
	let location: esbuild.PartialMessage['location'] = null;
	if (start && end) {
		const lineText = source.split(/\r\n|\r|\n/gu)[start.line - 1];
		const lineEnd = start.line === end.line ? end.column : lineText.length;
		location = {
			file: source_id,
			line: start.line,
			column: start.column,
			length: lineEnd - start.column,
			lineText,
		};
	}
	return {text: message, location};
};

// is not exported by Svelte
interface SvelteError {
	message: string;
	start?: LineInfo;
	end?: LineInfo;
}
interface LineInfo {
	line: number;
	column: number;
}
