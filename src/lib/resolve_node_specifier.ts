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

	let idx: number = -1;
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
	const pkg_name = idx === -1 ? mapped_specifier : mapped_specifier.substring(0, idx);
	const module_path = idx === -1 ? '' : mapped_specifier.substring(idx + 1);

	const subpath = module_path ? './' + module_path : '.';
	const package_dir = join(dir, NODE_MODULES_DIRNAME, pkg_name);
	const package_json = load_package_json(package_dir, cache);
	const exported = package_json.exports?.[subpath];
	if (!exported) {
		// same error message as Node
		throw Error(
			`[ERR_PACKAGE_PATH_NOT_EXPORTED]: Package subpath '${subpath}' is not defined by 'exports' in ${package_dir}/package.json` +
				(parent_url ? ` imported from ${parent_url}` : ''),
		);
	}
	let exported_value: string | undefined = exported[exports_key];
	if (exported_value === undefined && exports_key === 'default') {
		// Support both `default` and `import` as the exports key.
		exported_value = exported.import;
	}
	if (exported_value === undefined) {
		throw Error(
			`Package subpath '${subpath}' does not define the key '${exports_key}' in 'exports' in ${package_dir}/package.json` +
				(parent_url ? ` imported from ${parent_url}` : ''),
		);
	}
	const path_id = join(package_dir, exported_value);

	return {
		path_id,
		path_id_with_querystring: raw ? path_id + '?raw' : path_id,
		raw,
		specifier,
		mapped_specifier,
		namespace: undefined,
	};
};
