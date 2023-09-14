import {dirname, extname, join, relative} from 'node:path';

import {replace_extension} from './paths.js';
import {exists} from './exists.js';

export interface ResolvedSpecifier {
	specifier: string;
	source_id: string;
	namespace: string;
}

const default_passthrough_extensions = new Set(['.svelte', '.json']); // TODO BLOCK delete

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
	passthrough_extensions = default_passthrough_extensions, 
): Promise<ResolvedSpecifier> => {
	const importer_is_absolute = importer[0] === '/';
	if (!dir && !importer_is_absolute) {
		// TODO this restriction could be relaxed with a more complex implementation
		// to use a relative importer and absolute path, but we have no usecases
		throw Error('resolve_specifier requires either an absolute importer or a dir');
	}
	console.log(`path, importer, dir`, {path, importer, dir});
	const final_dir = dir || dirname(importer);
	console.log(`final_dir`, final_dir);
	const path_id = path[0] === '/' ? path : join(final_dir, path); // TODO BLOCK this is wrong, it's relative to importer not dir
	console.log(`path_id`, path_id);
	const importer_id = importer_is_absolute ? importer : join(dirname(path_id), importer);
	console.log(`importer_id`, importer_id);

	const ext = extname(path_id);
	const is_js = ext === '.js';
	const is_ts = ext === '.ts';
	// TODO BLOCK instead of passthrough, maybe just check for `.ts` then `.js` then the original, then fallback to ts? or is that an error?
	const passthrough = passthrough_extensions.has(ext);
	const js_path =
		is_js || passthrough ? path_id : is_ts ? replace_extension(path_id, '.js') : path_id + '.js';

	let mapped_path;
	let source_id;
	let namespace;
	if (await exists(js_path)) {
		// TODO BLOCK I think this is wrong, should be ts first -- maybe just explicit all the way?
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
	console.log(`mapped_path`, mapped_path);
	console.log(`source_id`, source_id);

	let specifier = relative(dirname(importer_id), mapped_path); // dirname of `importer_id` may not be `dir`
	if (specifier[0] !== '.') specifier = './' + specifier;

	console.log(`resolve_specifier`, specifier);
	return {specifier, source_id, namespace};
};
