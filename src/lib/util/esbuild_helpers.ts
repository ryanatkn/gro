import {yellow, red, magenta} from 'kleur/colors';
import type {Logger} from '@feltjs/util/log.js';
import type * as esbuild from 'esbuild';
import {dirname, extname, join, relative} from 'node:path';

import {replace_extension} from '../path/paths.js';
import {exists} from './exists.js';

export interface ParsedSpecifier {
	final_path: string;
	source_path: string;
	mapped_path: string;
	namespace: string;
}

// TODO BLOCK consider changing to return only absolute paths, maybe taking a dir, and add a helper for the relative specifier
/**
 * Maps `path` relative to the `importer`, and infer the correct extension.
 * If no `.js` file is found for the `path` on the filesystem, it assumes `.ts`.
 */
export const parse_specifier = async (path: string, importer: string): Promise<ParsedSpecifier> => {
	const path_is_relative = path[0] === '.';
	const importer_is_relative = importer[0] === '.';
	if (path_is_relative && importer_is_relative) {
		throw Error('parse_specifier failed, either path or importer must be absolute');
	}
	let mapped_path;
	let source_path;
	let namespace;
	const ext = extname(path);
	const is_js = ext === '.js';
	const is_ts = ext === '.ts';
	const js_path = is_js ? path : is_ts ? replace_extension(path, '.js') : path + '.js';
	// TODO BLOCK relative specifier here, need to make absolute first
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
	const importer_absolute = importer_is_relative ? join(dirname(mapped_path), importer) : importer;
	let final_path = path_is_relative
		? mapped_path
		: relative(dirname(importer_absolute), mapped_path);
	if (final_path[0] !== '.') final_path = './' + final_path;

	return {final_path, source_path, mapped_path, namespace};
};

export const print_build_result = (log: Logger, build_result: esbuild.BuildResult): void => {
	for (const error of build_result.errors) {
		log.error(red('esbuild error'), error);
	}
	for (const warning of build_result.warnings) {
		log.warn(yellow('esbuild warning'), warning);
	}
};
