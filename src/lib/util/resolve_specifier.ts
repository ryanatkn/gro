import {dirname, extname, join, relative} from 'node:path';

import {replace_extension} from './paths.js';
import {exists} from './exists.js';

export interface ResolvedSpecifier {
	specifier: string;
	source_id: string;
	namespace: string;
}

export const default_passthrough_extensions = new Set(['.svelte']); // mutate if you dare, it's probably ok, maybe we should add config

/**
 * Maps a `path` import specifier relative to the `importer`,
 * and infer the correct extension following Vite conventions.
 * If no `.js` file is found for the `path` on the filesystem, it assumes `.ts`.
 * @param path
 * @param importer - either must be absolute or a `dir` must be provided
 * @param dir - if defined, enables relative importers like from esbuild plugins
 * @param passthrough_extensions - used to support specifiers that have no file extention, which Vite supports, so we do our best effort
 * @returns
 */
export const resolve_specifier = async (
	path: string,
	importer: string,
	dir?: string,
	passthrough_extensions = default_passthrough_extensions, // TODO BLOCK param? include .js? see below for diff logic for js tho
): Promise<ResolvedSpecifier> => {
	const importer_is_absolute = importer[0] === '/';
	if (!dir && !importer_is_absolute) {
		// TODO this restriction could be relaxed with a more complex implementation
		// to use a relative importer and absolute path, but we have no usecases
		throw Error('resolve_specifier requires either an absolute importer or a dir');
	}
	const final_dir = dir || dirname(importer);
	console.log(`path, importer, dir, final_dir`, path, importer, dir, final_dir);
	const path_id = path[0] === '/' ? path : join(final_dir, path);
	const importer_id = importer_is_absolute ? importer : join(dirname(path), importer);

	const ext = extname(path_id);
	const is_js = ext === '.js';
	const is_ts = ext === '.ts';
	const passthrough = passthrough_extensions.has(ext);
	const js_path =
		is_js || passthrough ? path_id : is_ts ? replace_extension(path_id, '.js') : path_id + '.js';

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
			is_ts || passthrough ? path_id : is_js ? replace_extension(path_id, '.ts') : path_id + '.ts';
		mapped_path = replace_extension(source_id, '.js');
	}

	let specifier = relative(dirname(importer_id), mapped_path); // dirname of `importer_id` may not be `dir`
	if (specifier[0] !== '.') specifier = './' + specifier;

	return {specifier, source_id, namespace};
};
