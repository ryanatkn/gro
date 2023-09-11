import {yellow, red} from 'kleur/colors';
import type {Logger} from '@feltjs/util/log.js';
import type * as esbuild from 'esbuild';
import {dirname, extname, join, relative} from 'node:path';

import {replace_extension} from '../path/paths.js';
import {exists} from './exists.js';

export interface ParsedSpecifier {
	final_path: string;
	mapped_path: string;
	source_path: string;
	namespace: string;
}

/**
 * Maps `path` relative to the `importer`, and infer the correct extension.
 * If no `.js` source file is found, it assumes `.ts`.
 */
export const parse_specifier = async (path: string, importer: string): Promise<ParsedSpecifier> => {
	let mapped_path;
	let source_path;
	let namespace;
	const ext = extname(path);
	const is_js = ext === '.js';
	const is_ts = ext === '.ts';
	const js_path = is_js ? path : is_ts ? replace_extension(path, '.js') : path + '.js';
	if (await exists(js_path)) {
		namespace = 'sveltekit_local_imports_js';
		mapped_path = js_path;
		source_path = js_path;
	} else {
		// assume `.ts`, so other plugins like for `.svelte` and `.json` must be added earlier
		namespace = 'sveltekit_local_imports_ts';
		source_path = is_ts ? path : is_js ? replace_extension(path, '.ts') : path + '.ts';
		mapped_path = replace_extension(source_path, '.js');
	}

	const importer_absolute = importer[0] === '.' ? join(dirname(mapped_path), importer) : importer;
	let final_path = relative(dirname(importer_absolute), mapped_path);
	if (final_path[0] !== '.') final_path = './' + final_path;

	return {final_path, mapped_path, source_path, namespace};
};

export const print_build_result = (log: Logger, build_result: esbuild.BuildResult): void => {
	for (const error of build_result.errors) {
		log.error(red('esbuild error'), error);
	}
	for (const warning of build_result.warnings) {
		log.warn(yellow('esbuild warning'), warning);
	}
};
