import {join} from 'node:path';
import {existsSync} from 'node:fs';
import {DEV} from 'esm-env';

import {Package_Json, Package_Json_Exports, load_package_json} from './package_json.js';
import {paths} from './paths.js';
import {NODE_MODULES_DIRNAME} from './constants.js';
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
	// TODO this needs to use `--conditions`/`-C` to determine the correct key
	exports_condition = DEV ? 'development' : 'default',
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
				`Package not found at ${package_dir} for specifier ${specifier}, you may need to install packages or fix the path` +
					(parent_path ? ` imported from ${parent_path}` : ''),
			);
		} else {
			return null;
		}
	}

	const package_json = load_package_json(package_dir, cache, false);
	const {exported, exports_key} = resolve_subpath(package_json, specifier, subpath);
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
	const exported_value = resolve_exported_value(exported, exports_key, exports_condition);
	if (exported_value === undefined) {
		if (throw_on_missing_package) {
			throw Error(
				`Package subpath '${subpath}' does not define the key '${exports_key}' in 'exports' in ${package_dir}/package.json` +
					(parent_path ? ` imported from ${parent_path}` : ''),
			);
		} else {
			return null;
		}
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

/**
 * Resolves the subpath of a package.json `exports` field based on the `specifier`.
 */
const resolve_subpath = (
	package_json: Package_Json,
	specifier: string,
	subpath: string,
): {exported: Package_Json_Exports[string]; exports_key: string} => {
	const exports_key = specifier.endsWith('.svelte') ? 'svelte' : 'default';

	const exported =
		subpath === '.' && !package_json.exports
			? {[exports_key]: package_json.main}
			: package_json.exports?.[subpath];

	return {exported, exports_key};
};

// TODO BLOCK fix for node compat - https://nodejs.org/api/packages.html#resolving-user-conditions
/**
 * Resolves the exported value based on the exports key and condition.
 */
export const resolve_exported_value = (
	exported: Exclude<Package_Json_Exports[string], undefined>,
	exports_key: string,
	exports_condition: string,
): string | undefined => {
	let exported_value = typeof exported === 'string' ? exported : exported[exports_key];

	// TODO best effort fallback, support `default` but fall back to `import` or `node` as the exports key.
	if (exported_value === undefined && typeof exported !== 'string' && exports_key === 'default') {
		exported_value = exported.import ?? exported.node;
	}

	// Possibly resolve to conditional exports.
	exported_value =
		exported_value === undefined || typeof exported_value === 'string'
			? exported_value
			: (exported_value[exports_condition] ??
				exported_value.default ??
				exported_value.import ??
				exported_value.node); // TODO this fallback has corner case bugs for off-spec exports

	return exported_value;
};
