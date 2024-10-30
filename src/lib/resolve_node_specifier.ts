import {join, extname} from 'node:path';
import {existsSync} from 'node:fs';
import {DEV} from 'esm-env';

import {Export_Value, Package_Json, load_package_json} from './package_json.js';
import {paths} from './paths.js';
import {NODE_MODULES_DIRNAME} from './constants.js';
import type {Resolved_Specifier} from './resolve_specifier.js';

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

	// Check cache first
	let package_json: Package_Json | undefined;
	if (cache?.[pkg_name]) {
		package_json = cache[pkg_name];
	} else if (!existsSync(package_dir)) {
		if (throw_on_missing_package) {
			throw Error(
				`Package not found at ${package_dir} for specifier ${specifier}, you may need to install packages or fix the path` +
					(parent_path ? ` imported from ${parent_path}` : ''),
			);
		} else {
			return null;
		}
	} else {
		package_json = load_package_json(package_dir, cache, false);
	}

	// Handle self-referencing
	if (parent_path?.startsWith(package_dir)) {
		if (!package_json.exports) {
			if (throw_on_missing_package) {
				throw Error(
					`Self-referencing is only available if package.json has "exports" field: ${specifier}` +
						(parent_path ? ` imported from ${parent_path}` : ''),
				);
			} else {
				return null;
			}
		}
	}

	const exported = resolve_subpath(package_json, subpath);

	if (!exported) {
		if (throw_on_missing_package) {
			throw Error(
				`[ERR_PACKAGE_PATH_NOT_EXPORTED]: Package subpath '${subpath}' is not defined by 'exports' in ${package_dir}/package.json` +
					(parent_path ? ` imported from ${parent_path}` : ''),
			);
		} else {
			return null;
		}
	}

	const exported_value = resolve_exported_value(exported, exports_conditions, module_path);
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

export const resolve_subpath = (
	package_json: Package_Json,
	subpath: string,
	// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
): Export_Value | null => {
	// If no exports field exists, fallback to main field for the root subpath
	if (!package_json.exports) {
		return subpath === '.' && package_json.main ? package_json.main : null;
	}

	const exports = package_json.exports;

	// Handle exports sugar syntax
	if (typeof exports === 'string' && subpath === '.') {
		return exports;
	}

	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	if (typeof exports === 'object' && exports !== null) {
		// Check for exact match first
		if (subpath in exports) {
			return exports[subpath];
		}

		// Then check patterns, sorted by specificity
		const patterns = Object.entries(exports)
			.filter(([pattern]) => pattern.includes('*'))
			.sort((a, b) => {
				// Sort by static prefix length first
				const aStatic = a[0].split('*')[0].length;
				const bStatic = b[0].split('*')[0].length;
				if (aStatic !== bStatic) return bStatic - aStatic;
				// Then by number of path segments
				return (b[0].match(/\//g) ?? []).length - (a[0].match(/\//g) ?? []).length;
			});

		for (const [pattern, target] of patterns) {
			const regex_str = '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '(.*)') + '$';
			const regex = new RegExp(regex_str);
			const match = subpath.match(regex);

			if (match) {
				if (target === null) return null;

				const captures = match.slice(1);

				if (typeof target === 'string') {
					let result = target;
					for (const capture of captures) {
						result = result.replace('*', capture);
					}
					return result;
				}

				if (typeof target === 'object' && target !== null) {
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

export const resolve_exported_value = (
	exported: any,
	conditions: string[],
	captured_path?: string,
): string | undefined => {
	if (typeof exported === 'string') {
		// If this is a wildcard path and we have a captured path, replace the wildcard
		if (exported.includes('*') && captured_path) {
			const path_part = captured_path.substring(captured_path.lastIndexOf('/') + 1);
			// Remove .js extension from path_part if present
			const base_path_part = path_part.endsWith('.js') ? path_part.slice(0, -3) : path_part;
			return exported.replace('*', base_path_part);
		}
		return exported;
	}

	if (typeof exported !== 'object' || exported === null) {
		return undefined;
	}

	// Handle types condition first if present
	if ('types' in exported && conditions.includes('types')) {
		return resolve_exported_value(exported.types, conditions, captured_path);
	}

	// Handle user-specified conditions in order
	for (const condition of conditions) {
		if (!is_valid_condition(condition)) continue;

		if (condition in exported) {
			const result = resolve_exported_value(exported[condition], conditions, captured_path);
			if (result !== undefined) {
				return result;
			}
		}
	}

	// Finally, check default
	if ('default' in exported) {
		return resolve_exported_value(exported.default, conditions, captured_path);
	}

	return undefined;
};

const is_valid_condition = (condition: string): boolean => {
	if (
		condition.length === 0 ||
		condition.startsWith('.') ||
		condition.includes(',') ||
		/^\d+$/.test(condition)
	) {
		return false;
	}
	return /^[a-zA-Z0-9:_\-=]+$/.test(condition);
};

const normalize_extension = (path: string): string => {
	if (path.endsWith('.d.ts')) {
		return path.slice(0, -5) + '.js';
	}

	// No extension handling needed if path already has an extension
	if (extname(path)) {
		return path;
	}

	// If no extension at all, add .js
	return path + '.js';
};
