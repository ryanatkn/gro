import {yellow, red} from 'kleur/colors';
import type {Logger} from '@feltjs/util/log.js';
import type * as esbuild from 'esbuild';
import {dirname, extname, join, relative} from 'node:path';

import {replace_extension} from '../path/paths.js';
import {exists} from './exists.js';

export interface ParsedSpecifier {
	specifier: string;
	// TODO BLOCK see below
	// specifier_id: string;
	source_id: string;
	namespace: string;
}

/**
 * Maps `path` relative to the `importer`, and infer the correct extension.
 * If no `.js` file is found for the `path` on the filesystem, it assumes `.ts`.
 */
export const parse_specifier = async (
	path: string,
	importer: string,
	dir: string,
): Promise<ParsedSpecifier> => {
	// TODO BLOCK ?
	if (!dir) throw Error('DELETEME'); // TODO BLOCK
	const path_absolute = path[0] === '.' ? join(dir, path) : path;
	const importer_absolute = importer[0] === '.' ? join(dirname(path), importer) : importer;

	const ext = extname(path_absolute);
	const is_js = ext === '.js';
	const is_ts = ext === '.ts';
	const passthrough_extensions = new Set(['.svelte']); // TODO BLOCK param? include .js? see below for diff logic for js tho
	const passthrough = passthrough_extensions.has(ext);
	const js_path =
		is_js || passthrough
			? path_absolute
			: is_ts
			? replace_extension(path_absolute, '.js')
			: path_absolute + '.js';

	let mapped_path;
	let source_id;
	let namespace;
	if (await exists(js_path)) {
		// a `.js` version exists on the filesystem, so use it
		namespace = 'sveltekit_local_imports_js';
		mapped_path = js_path;
		source_id = js_path;
	} else {
		// assume `.ts`, so other plugins like for `.svelte` and `.json` must be added earlier
		namespace = 'sveltekit_local_imports_ts';
		source_id =
			is_ts || passthrough
				? path_absolute
				: is_js
				? replace_extension(path_absolute, '.ts')
				: path_absolute + '.ts';
		mapped_path = replace_extension(source_id, '.js');
	}

	let specifier = relative(dirname(importer_absolute), mapped_path);
	if (specifier[0] !== '.') specifier = './' + specifier;

	// const specifier_id = join(dirname(importer_absolute), specifier);
	// specifier_id,

	return {specifier, source_id, namespace};
};

export const print_build_result = (log: Logger, build_result: esbuild.BuildResult): void => {
	for (const error of build_result.errors) {
		log.error(red('esbuild error'), error);
	}
	for (const warning of build_result.warnings) {
		log.warn(yellow('esbuild warning'), warning);
	}
};
