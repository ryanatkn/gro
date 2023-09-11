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

/**
 * Maps `path` relative to the `importer`, and infer the correct extension.
 * If no `.js` source file is found, it assumes `.ts`.
 */
export const parse_specifier = async (path: string, importer: string): Promise<ParsedSpecifier> => {
	if (path[0] !== '/' && importer[0] !== '/') {
		throw Error('parse_specifier failed, either path or importer must be absolute');
	}
	console.log(magenta(`[parse_specifier] enter`), {path, importer});
	let mapped_path;
	let source_path;
	let namespace;
	const ext = extname(path);
	console.log(`ext`, ext);
	const is_js = ext === '.js';
	const is_ts = ext === '.ts';
	console.log(`is_js, is_ts`, is_js, is_ts);
	const js_path = is_js ? path : is_ts ? replace_extension(path, '.js') : path + '.js';
	if (await exists(js_path)) {
		console.log(`js_path exists`, js_path);
		namespace = 'sveltekit_local_imports_js';
		mapped_path = js_path;
		source_path = js_path;
	} else {
		console.log('js_path doesnt exist', js_path);
		// assume `.ts`, so other plugins like for `.svelte` and `.json` must be added earlier
		namespace = 'sveltekit_local_imports_ts';
		source_path = is_ts ? path : is_js ? replace_extension(path, '.ts') : path + '.ts';
		mapped_path = replace_extension(source_path, '.js');
	}
	console.log(`mapped_path`, mapped_path);
	console.log(`source_path`, source_path);

	const importer_absolute = importer[0] === '.' ? join(dirname(mapped_path), importer) : importer;
	console.log(`importer_absolute`, importer_absolute);
	let final_path =
		mapped_path[0] === '.' ? mapped_path : relative(dirname(importer_absolute), mapped_path);
	console.log(`final_path before`, final_path);
	if (final_path[0] !== '.') final_path = './' + final_path;
	console.log(`final_path DONE`, final_path);

	console.log(magenta(`[parse_specifier] LEAVE`), {
		final_path,
		source_path,
		mapped_path,
		namespace,
	});
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
