// resolve_node_specifier.ts
import {join} from 'node:path';
import {existsSync} from 'node:fs';
import {DEV} from 'esm-env';

import {Export_Value, Package_Json, load_package_json} from './package_json.js';
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
	const exported = resolve_subpath(package_json, subpath);

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

	const exported_value = resolve_exported_value(exported, exports_conditions);
	if (exported_value === undefined) {
		if (throw_on_missing_package) {
			throw Error(
				`No valid export found for subpath '${subpath}' in ${package_dir}/package.json with the following conditions: ${exports_conditions.join(', ')}` +
					(parent_path ? ` imported from ${parent_path}` : ''),
			);
		} else {
			return null;
		}
	}

	const path_id = normalize_extension(join(package_dir, exported_value));

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
 * Resolves the subpath of a package.json `exports` field.
 * Handles both direct exports and pattern exports.
 */
export const resolve_subpath = (
	package_json: Package_Json,
	subpath: string,
	// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
): Export_Value | null => {
	if (!package_json.exports) {
		return subpath === '.' && package_json.main ? package_json.main : null;
	}

	const exports = package_json.exports;

	if (typeof exports === 'string' && subpath === '.') {
		return exports;
	}

	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	if (typeof exports === 'object' && exports !== null) {
		// First try exact match
		if (subpath in exports) {
			return exports[subpath];
		}

		// Find all patterns that could match
		const patterns = Object.entries(exports).filter(([pattern]) => pattern.includes('*'));

		// For each pattern, see if it matches
		for (const [pattern, target] of patterns) {
			// Replace * with a capture group that matches anything (including slashes)
			// Note: we escape the dot in the pattern to match it literally
			const regex_str = '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '(.*)') + '$';
			const regex = new RegExp(regex_str);
			const match = subpath.match(regex);

			if (match) {
				// If this is a null target, block this path
				if (target === null) {
					return null; // Block this path
				}

				// For string targets, replace wildcards with captured values
				if (typeof target === 'string') {
					const captures = match.slice(1);
					let result = target;
					for (const capture of captures) {
						result = result.replace('*', capture);
					}
					return result;
				}

				// For object targets (conditional exports), process wildcards in values
				if (typeof target === 'object' && target !== null) {
					const captures = match.slice(1);
					return Object.fromEntries(
						Object.entries(target).map(([key, value]) => {
							if (typeof value === 'string') {
								let result = value;
								for (const capture of captures) {
									result = result.replace('*', capture);
								}
								return [key, result];
							}
							return [key, value];
						}),
					);
				}
			}
		}
	}

	return null;
};

/**
 * Resolves the exported value based on conditions.
 * Respects the order of conditions in the exports object.
 */
export const resolve_exported_value = (
	exported: Export_Value,
	exports_conditions: string[],
): string | undefined => {
	if (typeof exported === 'string') {
		return exported;
	}

	if (!is_exports_object(exported)) {
		return undefined;
	}

	// First try conditions in order
	for (const condition of exports_conditions) {
		if (condition in exported) {
			const result = resolve_conditions(exported[condition], exports_conditions);
			if (result !== undefined) {
				return result;
			}
		}
	}

	// Then try default
	if ('default' in exported) {
		return resolve_conditions(exported.default, exports_conditions);
	}

	return undefined;
};

const resolve_conditions = (
	value: Export_Value,
	exports_conditions: string[],
): string | undefined => {
	if (typeof value === 'string') {
		return value;
	}

	if (value === null || !is_exports_object(value)) {
		return undefined;
	}

	// First try conditions in order
	for (const condition of exports_conditions) {
		if (condition in value) {
			const result = resolve_conditions(value[condition], exports_conditions);
			if (result !== undefined) {
				return result;
			}
		}
	}

	// Then try default
	if ('default' in value) {
		return resolve_conditions(value.default, exports_conditions);
	}

	return undefined;
};

const is_exports_object = (value: any): value is Record<string, any> =>
	value !== null && typeof value === 'object';

// Update resolve_node_specifier to handle file extensions
const normalize_extension = (path: string): string => {
	// If path ends with .d.ts, remove it and replace with .js
	if (path.endsWith('.d.ts')) {
		return path.slice(0, -5) + '.js';
	}
	return path;
};
