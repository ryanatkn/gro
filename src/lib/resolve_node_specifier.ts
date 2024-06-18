import {join} from 'node:path';

import {Package_Json, load_package_json} from './package_json.js';
import type {Path_Id} from './path.js';
import {paths} from './paths.js';
import {NODE_MODULES_DIRNAME} from './path_constants.js';

export const resolve_node_specifier = async (
	specifier: string,
	dir = paths.root,
	parent_url?: string,
	cache?: Record<string, Package_Json>,
	exports_key = specifier.endsWith('.svelte') ? 'svelte' : 'default',
): Promise<Path_Id> => {
	const parsed = parse_node_specifier(specifier);
	const subpath = './' + parsed.path;
	const package_dir = join(dir, NODE_MODULES_DIRNAME, parsed.name);
	const package_json = await load_package_json(package_dir, cache);
	const exported = package_json.exports?.[subpath];
	if (!exported) {
		// same error message as Node
		throw Error(
			`[ERR_PACKAGE_PATH_NOT_EXPORTED]: Package subpath '${subpath}' is not defined by "exports" in ${package_dir}/package.json` +
				(parent_url ? ` imported from ${parent_url}` : ''),
		);
	}
	const path_id = join(package_dir, exported[exports_key]);
	return path_id;
};

export interface Parsed_Node_Specifier {
	name: string;
	path: string;
}

export const parse_node_specifier = (specifier: string): Parsed_Node_Specifier => {
	let idx!: number;
	if (specifier[0] === '@') {
		// get the index of the second `/`
		let count = 0;
		for (let i = 0; i < specifier.length; i++) {
			if (specifier[i] === '/') count++;
			if (count === 2) {
				idx = i;
				break;
			}
		}
	} else {
		idx = specifier.indexOf('/');
	}
	return {
		name: specifier.substring(0, idx),
		path: specifier.substring(idx + 1),
	};
};
