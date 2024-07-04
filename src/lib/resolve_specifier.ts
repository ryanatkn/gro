import {extname, isAbsolute, join, relative} from 'node:path';
import {existsSync} from 'node:fs';

import {replace_extension} from './paths.js';
import type {Path_Id} from './path.js';

export interface Resolved_Specifier {
	specifier: string;
	path_id: Path_Id;
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
export const resolve_specifier = (path: string, dir: string): Resolved_Specifier => {
	const absolute_path = isAbsolute(path) ? path : join(dir, path);

	let mapped_path;
	let path_id;
	let namespace: Resolved_Specifier['namespace'];

	const ext = extname(absolute_path);
	const is_js = ext === '.js';
	const is_ts = ext === '.ts';

	if (!is_js && !is_ts && existsSync(absolute_path)) {
		// unrecognized extension and the file exists
		mapped_path = absolute_path;
		path_id = absolute_path;
	} else if (is_ts) {
		// explicitly ts
		mapped_path = replace_extension(absolute_path, '.js');
		path_id = absolute_path;
		namespace = 'sveltekit_local_imports_ts';
	} else {
		// extensionless, or js that points to ts, or just js
		const js_id = is_js ? absolute_path : absolute_path + '.js';
		const ts_id = is_js ? replace_extension(absolute_path, '.ts') : absolute_path + '.ts';
		if (!existsSync(ts_id) && existsSync(js_id)) {
			mapped_path = js_id;
			path_id = js_id;
			namespace = 'sveltekit_local_imports_js';
		} else {
			mapped_path = js_id;
			path_id = ts_id;
			namespace = 'sveltekit_local_imports_ts';
		}
	}

	let specifier = relative(dir, mapped_path);
	if (specifier[0] !== '.') specifier = './' + specifier;

	return {specifier, path_id, namespace};
};
