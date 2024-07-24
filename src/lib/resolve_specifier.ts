import {extname, isAbsolute, join, relative} from 'node:path';
import {existsSync} from 'node:fs';

import {replace_extension} from './paths.js';
import type {Path_Id} from './path.js';

export interface Resolved_Specifier {
	/**
	 * The resolved filesystem path for the specifier.
	 */
	path_id: Path_Id;
	/**
	 * Same as `path_id` but includes `?raw` and other modifiers. (currently none)
	 */
	path_id_with_querystring: string;
	specifier: string;
	mapped_specifier: string;
	namespace: undefined | 'sveltekit_local_imports_ts' | 'sveltekit_local_imports_js';
	raw: boolean;
}

/**
 * Maps a `path` import specifier relative to the `importer`,
 * and infer the correct extension following Vite conventions.
 * If no `.js` file is found for the `path` on the filesystem, it assumes `.ts`.
 * @param specifier
 * @param dir - if defined, enables relative importers like from esbuild plugins
 * @param passthrough_extensions - used to support specifiers that have no file extention, which Vite supports, so we do our best effort
 * @returns
 */
export const resolve_specifier = (specifier: string, dir: string): Resolved_Specifier => {
	const raw = specifier.endsWith('?raw');
	const final_specifier = raw ? specifier.substring(0, specifier.length - 4) : specifier;
	const absolute_path = isAbsolute(final_specifier) ? final_specifier : join(dir, final_specifier);

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

	let mapped_specifier = relative(dir, mapped_path);
	if (mapped_specifier[0] !== '.') mapped_specifier = './' + mapped_specifier;

	return {
		path_id,
		path_id_with_querystring: raw ? path_id + '?raw' : path_id,
		raw,
		specifier,
		mapped_specifier,
		namespace,
	};
};
