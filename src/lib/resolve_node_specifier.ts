import {join} from 'node:path';
import {existsSync} from 'node:fs';

import {Package_Json, load_package_json} from './package_json.js';
import {paths} from './paths.js';
import {NODE_MODULES_DIRNAME} from './path_constants.js';
import type {Resolved_Specifier} from './resolve_specifier.js';

/**
 * Like `resolve_specifier` but for Node specifiers,
 * typically those that aren't relative or absolute.
 * Optionally return `null` instead of throwing by setting
 * `throw_on_missing_package` to `false`.
 */
export const resolve_node_specifier = (
	specifier: string,
	dir = paths.root,
	parent_path?: string,
	cache?: Record<string, Package_Json>,
	throw_on_missing_package = true,
): Resolved_Specifier | null => {
	const raw = specifier.endsWith('?raw');
	const mapped_specifier = raw ? specifier.substring(0, specifier.length - 4) : specifier;

	// Parse the specifier
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

	if (!existsSync(package_dir)) {
		if (throw_on_missing_package) {
			throw Error(
				`Package not found at ${package_dir} for specifier ${specifier}, you may need to npm install or fix the path` +
					(parent_path ? ` imported from ${parent_path}` : ''),
			);
		} else {
			return null;
		}
	}

	const package_json = load_package_json(package_dir, cache, false);
	const exports_key = specifier.endsWith('.svelte') ? 'svelte' : 'default';
	const exported =
		subpath === '.' && !package_json.exports
			? {[exports_key]: package_json.main}
			: package_json.exports?.[subpath];
	if (!exported) {
		if (throw_on_missing_package) {
			// same error message as Node
			throw Error(
				`[ERR_PACKAGE_PATH_NOT_EXPORTED]: Package subpath '${subpath}' is not defined by 'exports' in ${package_dir}/package.json` +
					(parent_path ? ` imported from ${parent_path}` : ''),
			);
		} else {
			return null;
		}
	}
	let exported_value: string | undefined = exported[exports_key];
	if (exported_value === undefined && exports_key === 'default') {
		// Support both `default` and `import` as the exports key.
		exported_value = exported.import;
	}
	if (exported_value === undefined) {
		throw Error(
			`Package subpath '${subpath}' does not define the key '${exports_key}' in 'exports' in ${package_dir}/package.json` +
				(parent_path ? ` imported from ${parent_path}` : ''),
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
