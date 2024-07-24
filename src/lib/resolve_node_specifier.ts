import {join} from 'node:path';

import {Package_Json, load_package_json} from './package_json.js';
import {paths} from './paths.js';
import {NODE_MODULES_DIRNAME} from './path_constants.js';
import type {Resolved_Specifier} from './resolve_specifier.js';

export const resolve_node_specifier = (
	specifier: string,
	dir = paths.root,
	parent_url?: string,
	cache?: Record<string, Package_Json>,
	exports_key = specifier.endsWith('.svelte') ? 'svelte' : 'default',
): Resolved_Specifier => {
	const raw = specifier.endsWith('?raw');
	const mapped_specifier = raw ? specifier.substring(0, specifier.length - 4) : specifier;

	let idx!: number;
	if (mapped_specifier[0] === '@') {
		// get the index of the second `/`
		let count = 0;
		for (let i = 0; i < mapped_specifier.length; i++) {
			if (mapped_specifier[i] === '/') count++;
			if (count === 2) {
				idx = i;
				break;
			}
		}
	} else {
		idx = mapped_specifier.indexOf('/');
	}
	const name = mapped_specifier.substring(0, idx);
	const path = mapped_specifier.substring(idx + 1);

	const subpath = './' + path;
	const package_dir = join(dir, NODE_MODULES_DIRNAME, name);
	const package_json = load_package_json(package_dir, cache);
	const exported = package_json.exports?.[subpath];
	if (!exported) {
		// same error message as Node
		throw Error(
			`[ERR_PACKAGE_PATH_NOT_EXPORTED]: Package subpath '${subpath}' is not defined by "exports" in ${package_dir}/package.json` +
				(parent_url ? ` imported from ${parent_url}` : ''),
		);
	}
	const path_id = join(package_dir, exported[exports_key]);

	return {
		path_id,
		path_id_with_querystring: raw ? path_id + '?raw' : path_id,
		raw,
		specifier,
		mapped_specifier,
		namespace: undefined,
	};
};
