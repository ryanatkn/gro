import {join, extname} from 'node:path';
import {existsSync} from 'node:fs';
import {DEV} from 'esm-env';

import {Export_Value, Package_Json, load_package_json} from './package_json.js';
import {paths} from './paths.js';
import {NODE_MODULES_DIRNAME} from './constants.js';
import type {Resolved_Specifier} from './resolve_specifier.js';
import {escape_regexp} from '@ryanatkn/belt/regexp.js';

/**
 * This likely has differences from Node - they should be fixed on a case-by-case basis.
 */
export const resolve_node_specifier = (
	specifier: string,
	dir = paths.root,
	parent_path?: string,
	package_json_cache?: Record<string, Package_Json>,
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

	// Check package_json cache first
	let package_json: Package_Json | undefined;
	if (package_json_cache?.[pkg_name]) {
		package_json = package_json_cache[pkg_name];
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
		package_json = load_package_json(package_dir, package_json_cache, false);
	}

	// Handle self-referencing
	if (parent_path?.startsWith(package_dir)) {
		if (!package_json.exports) {
			throw Error(
				`Self-referencing is only available if package.json has "exports" field: ${specifier}` +
					(parent_path ? ` imported from ${parent_path}` : ''),
			);
		}
	}

	const exported = resolve_subpath(package_json, subpath);

	if (typeof exported === 'string') {
		const validated = validate_export_target(exported, throw_on_missing_package);
		if (validated === null) {
			return null;
		}
	}

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

const replace_wildcards = (pattern: string, wildcards: string[]): string => {
	if (!pattern.includes('*')) return pattern;

	let result = pattern;
	let wildcard_index = 0;
	while (result.includes('*') && wildcard_index < wildcards.length) {
		result = result.replace('*', wildcards[wildcard_index++]);
	}
	return result;
};

const resolve_subpath = (package_json: Package_Json, subpath: string): unknown => {
	// If no exports field exists, fallback to main field for the root subpath
	if (!package_json.exports) {
		return subpath === '.' && package_json.main ? package_json.main : null;
	}

	const exports = package_json.exports;

	// Handle exports sugar syntax
	if (typeof exports === 'string') {
		return subpath === '.' ? exports : null;
	}

	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	if (typeof exports === 'object' && exports !== null) {
		// Check for exact match first
		if (subpath in exports) {
			return exports[subpath];
		}

		// Sort patterns by specificity
		const patterns = Object.entries(exports)
			.filter(([pattern]) => pattern.includes('*'))
			.map(([pattern, target]) => ({
				pattern,
				target,
				static_prefix: pattern.split('*')[0],
				segments: pattern.split('/').length,
				wildcards: (pattern.match(/\*/g) ?? []).length,
			}))
			.sort((a, b) => {
				// Sort by static prefix length first
				const prefix_diff = b.static_prefix.length - a.static_prefix.length;
				if (prefix_diff !== 0) return prefix_diff;

				// Then by number of segments
				const segment_diff = b.segments - a.segments;
				if (segment_diff !== 0) return segment_diff;

				// Then by number of wildcards (fewer is more specific)
				const wildcard_diff = a.wildcards - b.wildcards;
				if (wildcard_diff !== 0) return wildcard_diff;

				// Finally by total pattern length
				return b.pattern.length - a.pattern.length;
			});

		// Track matched wildcards for later use
		let matched_wildcards: string[] = [];

		// Check patterns in order of specificity
		for (const {pattern, target} of patterns) {
			// Convert pattern to regex, handling path segments properly
			const regex_pattern = pattern.split('*').map(escape_regexp).join('([^/]+)');
			const regex = new RegExp(`^${regex_pattern}$`);
			const match = subpath.match(regex);

			if (match) {
				// If this is a null pattern and it matches, block access
				if (target === null) return null;

				// Extract captured wildcards and store them
				matched_wildcards = match.slice(1);

				if (typeof target === 'string') {
					return replace_wildcards(target, matched_wildcards);
				}

				if (typeof target === 'object' && target !== null) {
					// For conditional exports, return an object with resolved wildcards
					return Object.fromEntries(
						Object.entries(target).map(([key, value]) => {
							if (typeof value === 'string') {
								return [key, replace_wildcards(value, matched_wildcards)];
							}
							// Handle nested conditions
							if (typeof value === 'object' && value !== null) {
								return [
									key,
									Object.fromEntries(
										Object.entries(value).map(([nested_key, nested_value]) => [
											nested_key,
											typeof nested_value === 'string'
												? replace_wildcards(nested_value, matched_wildcards)
												: nested_value,
										]),
									),
								];
							}
							return [key, value];
						}),
					);
				}
			}
		}

		// Handle catch-all patterns for remaining cases
		const catch_all_patterns = patterns.filter(
			({pattern}) => pattern.endsWith('/*') || pattern === './*',
		);

		for (const {pattern, target} of catch_all_patterns) {
			const base_pattern = pattern.slice(0, -1); // Remove trailing '*'
			if (subpath.startsWith(base_pattern)) {
				if (target === null) return null;

				const remainder = subpath.slice(base_pattern.length);
				if (typeof target === 'string') {
					return target.slice(0, -1) + remainder;
				}
			}
		}
	}

	return null;
};

const resolve_exported_value = (
	exported: Export_Value,
	conditions: string[],
): string | undefined => {
	if (typeof exported === 'string') {
		return exported;
	}

	if (typeof exported !== 'object' || exported === null) {
		return undefined;
	}

	const exported_obj = exported as Record<string, unknown>;

	// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
	let default_value: Export_Value | undefined;

	// For each key in exported_obj, in order
	for (const [condition, value] of Object.entries(exported_obj)) {
		// Skip invalid conditions
		if (!is_valid_condition(condition)) {
			continue;
		}

		if (condition === 'default') {
			// Store default value to try last
			default_value = value;
		} else if (conditions.includes(condition)) {
			const resolved = resolve_exported_value(value, conditions);
			if (resolved !== undefined) {
				return resolved;
			}
		}
	}

	// If no conditions matched, try default
	if (default_value !== undefined) {
		const resolved = resolve_exported_value(default_value, conditions);
		if (resolved !== undefined) {
			return resolved;
		}
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

const validate_export_target = (target: string, throw_on_missing_package: boolean): void | null => {
	// Must start with './'
	if (!target.startsWith('./') && !target.startsWith('../')) {
		if (throw_on_missing_package) {
			throw new Error('ERR_INVALID_PACKAGE_TARGET: Export target must start with "./" or "../"');
		} else {
			return null;
		}
	}

	// Can't contain node_modules
	if (target.includes('node_modules')) {
		if (throw_on_missing_package) {
			throw new Error('ERR_INVALID_PACKAGE_TARGET: Export target cannot contain node_modules');
		} else {
			return null;
		}
	}

	// Check for package boundary escape
	const parts = target.split('/');
	let depth = 0;

	for (const part of parts) {
		if (part === '..') {
			depth--;
			// If we go above root, it's escaping the package boundary
			if (depth < 0) {
				if (throw_on_missing_package) {
					throw new Error(
						'ERR_INVALID_PACKAGE_TARGET: Export target cannot escape package boundary',
					);
				} else {
					return null;
				}
			}
		} else if (part !== '.' && part !== '') {
			depth++;
		}
	}
};
