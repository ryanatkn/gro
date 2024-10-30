import {join} from 'node:path';
import {existsSync} from 'node:fs';
import {DEV} from 'esm-env';

import {
	Export_Value,
	Package_Json,
	Package_Json_Exports,
	load_package_json,
} from './package_json.js';
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
	exports_conditions = DEV ? ['development', 'node', 'import'] : ['production', 'node', 'import'],
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
	const exported_value = resolve_exported_value(exported, exports_key, exports_conditions);
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
): {exported: Export_Value; exports_key: string} => {
	const exports_key = specifier.endsWith('.svelte') ? 'svelte' : 'default';

	let exported: Export_Value;

	if (subpath === '.' && !package_json.exports && package_json.main) {
		exported = {[exports_key]: package_json.main};
	} else {
		// Cast the exports lookup to the correct type
		exported = (package_json.exports?.[subpath] ?? null) as Export_Value;
	}

	return {exported, exports_key};
};

/**
 * Resolves the exported value based on the exports key and condition.
 */
export const resolve_exported_value = (
	exported: Exclude<Package_Json_Exports[string], undefined>,
	exports_key: string,
	exports_conditions: string[],
): string | undefined => {
	// Helper function to check if a value is a valid exports object

	// Handle direct string or null exports
	if (typeof exported === 'string') return exported;
	if (!is_exports_object(exported)) return undefined;

	// If we have a specific exports_key, try that first
	if (exports_key !== 'default' && exports_key in exported) {
		const result = resolve_conditions(exported[exports_key], exports_conditions);
		if (result !== undefined) return result;
	}

	// Try resolving conditions directly on the object
	const direct_result = resolve_conditions(exported, exports_conditions);
	if (direct_result !== undefined) return direct_result;

	// For default key, try fallback resolution order
	if (exports_key === 'default') {
		for (const key of ['import', 'node', 'node-addons']) {
			if (key in exported) {
				const result = resolve_conditions(exported[key], exports_conditions);
				if (result !== undefined) return result;
			}
		}
	}

	return undefined;
};

const resolve_conditions = (value: any, exports_conditions: string[]): string | undefined => {
	// Direct string resolution
	if (typeof value === 'string') return value;
	if (!is_exports_object(value)) return undefined;

	// First try the conditions in order
	for (const condition of exports_conditions) {
		if (condition in value) {
			const result = resolve_conditions(value[condition], exports_conditions);
			if (result !== undefined) return result;
		}
	}

	// Then try default condition
	if ('default' in value) {
		return resolve_conditions(value.default, exports_conditions);
	}

	return undefined;
};

const is_exports_object = (value: any): value is Record<string, any> =>
	value !== null && typeof value === 'object';
