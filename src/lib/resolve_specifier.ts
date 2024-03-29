import {extname, join, relative} from 'node:path';

import {replace_extension} from './paths.js';
import {exists} from './fs.js';

export interface Resolved_Specifier {
	specifier: string;
	source_id: string;
	namespace: undefined | 'sveltekit_local_imports_ts' | 'sveltekit_local_imports_js';
}

/**
 * Maps a `path` import specifier relative to the `importer`,
 * and infer the correct extension following Vite conventions.
 * If no `.js` file is found for the `path` on the filesystem, it assumes `.ts`.
 * @param path
 * @param dir - if defined, enables relative importers like from esbuild plugins
 * @param passthrough_extensions - used to support specifiers that have no file extention, which Vite supports, so we do our best effort
 * @returns
 */
export const resolve_specifier = async (path: string, dir: string): Promise<Resolved_Specifier> => {
	const path_id = path[0] === '/' ? path : join(dir, path);

	let mapped_path;
	let source_id;
	let namespace: Resolved_Specifier['namespace'];

	const ext = extname(path_id);
	const is_js = ext === '.js';
	const is_ts = ext === '.ts';

	if (!is_js && !is_ts && (await exists(path_id))) {
		// unrecognized extension and the file exists
		mapped_path = path_id;
		source_id = path_id;
	} else if (is_ts) {
		// explicitly ts
		mapped_path = replace_extension(path_id, '.js');
		source_id = path_id;
		namespace = 'sveltekit_local_imports_ts';
	} else {
		// extensionless, or js that points to ts, or just js
		const js_id = is_js ? path_id : path_id + '.js';
		const ts_id = is_js ? replace_extension(path_id, '.ts') : path_id + '.ts';
		if (!(await exists(ts_id)) && (await exists(js_id))) {
			mapped_path = js_id;
			source_id = js_id;
			namespace = 'sveltekit_local_imports_js';
		} else {
			mapped_path = js_id;
			source_id = ts_id;
			namespace = 'sveltekit_local_imports_ts';
		}
	}

	let specifier = relative(dir, mapped_path);
	if (specifier[0] !== '.') specifier = './' + specifier;

	return {specifier, source_id, namespace};
};
