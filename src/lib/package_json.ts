import {z} from 'zod';
import {join} from 'node:path';
import {readFileSync, writeFileSync} from 'node:fs';
import {plural, strip_end} from '@ryanatkn/belt/string.js';
import type {Logger} from '@ryanatkn/belt/log.js';
import {styleText as st} from 'node:util';
import {Package_Json, Package_Json_Exports} from '@ryanatkn/belt/package_json.js';

import {paths, gro_paths, IS_THIS_GRO, replace_extension} from './paths.ts';
import {SVELTEKIT_DIST_DIRNAME} from './constants.ts';
import {search_fs} from './search_fs.ts';
import {has_sveltekit_library} from './sveltekit_helpers.ts';
import {GITHUB_REPO_MATCHER} from './github.ts';

export type Map_Package_Json = (
	package_json: Package_Json,
) => Package_Json | null | Promise<Package_Json | null>;

export const EMPTY_PACKAGE_JSON: Package_Json = {name: '', version: ''};

export const load_package_json = (
	dir = IS_THIS_GRO ? gro_paths.root : paths.root,
	cache?: Record<string, Package_Json>,
	parse = true, // TODO pass `false` here in more places, especially anything perf-sensitive like work on startup
): Package_Json => {
	let package_json: Package_Json;
	if (cache && dir in cache) {
		return cache[dir];
	}
	try {
		package_json = JSON.parse(load_package_json_contents(dir));
	} catch (_err) {
		return EMPTY_PACKAGE_JSON;
	}
	if (parse) {
		package_json = parse_package_json(Package_Json, package_json);
	}
	if (cache) {
		cache[dir] = package_json;
	}
	return package_json;
};

export const sync_package_json = async (
	map_package_json: Map_Package_Json,
	log: Logger,
	check = false,
	dir = paths.root,
	exports_dir = paths.lib,
): Promise<{package_json: Package_Json | null; changed: boolean}> => {
	const exported_files = search_fs(exports_dir);
	const exported_paths = exported_files.map((f) => f.path);
	const updated = await update_package_json(
		dir,
		async (package_json) => {
			if (has_sveltekit_library(package_json).ok) {
				const exports = to_package_exports(exported_paths);
				package_json.exports = exports;
			}
			const mapped = await map_package_json(package_json);
			return mapped ? parse_package_json(Package_Json, mapped) : mapped;
		},
		!check,
	);

	const exports_count =
		updated.changed && updated.package_json?.exports
			? Object.keys(updated.package_json.exports).length
			: 0;
	log.info(
		updated.changed
			? `updated package.json exports with ${exports_count} total export${plural(exports_count)}`
			: 'no changes to exports in package.json',
	);

	return updated;
};

export const load_gro_package_json = (): Package_Json => load_package_json(gro_paths.root);

// TODO probably make this nullable and make callers handle failures
const load_package_json_contents = (dir: string): string =>
	readFileSync(join(dir, 'package.json'), 'utf8');

export const write_package_json = (serialized_package_json: string): void => {
	writeFileSync(join(paths.root, 'package.json'), serialized_package_json);
};

export const serialize_package_json = (package_json: Package_Json): string =>
	JSON.stringify(parse_package_json(Package_Json, package_json), null, 2) + '\n';

/**
 * Updates package.json. Writes to the filesystem only when contents change.
 */
export const update_package_json = async (
	dir = paths.root,
	update: (package_json: Package_Json) => Package_Json | null | Promise<Package_Json | null>,
	write = true,
): Promise<{package_json: Package_Json | null; changed: boolean}> => {
	const original_contents = load_package_json_contents(dir);
	const original = JSON.parse(original_contents);
	const updated = await update(original);
	if (updated === null) {
		return {package_json: original, changed: false};
	}
	const updated_contents = serialize_package_json(updated);
	if (updated_contents === original_contents) {
		return {package_json: original, changed: false};
	}
	if (write) write_package_json(updated_contents);
	return {package_json: updated, changed: true};
};

const is_index = (path: string): boolean => path === 'index.ts' || path === 'index.js';

export const to_package_exports = (paths: Array<string>): Package_Json_Exports => {
	const sorted = paths
		.slice()
		.sort((a, b) => (is_index(a) ? -1 : is_index(b) ? 1 : a.localeCompare(b)));
	// Add the package.json after the index, if one exists.
	// Including the `./` here ensures we don't conflict with any potential `$lib/package.json`.
	const final_sorted = is_index(sorted[0])
		? [sorted[0]].concat('./package.json', sorted.slice(1))
		: ['./package.json'].concat(sorted);
	const exports: Package_Json_Exports = {};
	for (const path of final_sorted) {
		if (path === './package.json') {
			exports['./package.json'] = './package.json';
		} else if (path.endsWith('.json.d.ts')) {
			const json_path = path.substring(0, path.length - 5);
			exports['./' + json_path] = {
				types: IMPORT_PREFIX + path,
				default: IMPORT_PREFIX + json_path, // assuming a matching json file
			};
		} else if (path.endsWith('.ts') && !path.endsWith('.d.ts')) {
			const js_path = replace_extension(path, '.js');
			const key = is_index(path) ? '.' : './' + js_path;
			exports[key] = {
				types: IMPORT_PREFIX + replace_extension(path, '.d.ts'),
				default: IMPORT_PREFIX + js_path,
			};
		} else if (path.endsWith('.js')) {
			const key = is_index(path) ? '.' : './' + path;
			exports[key] = {
				types: IMPORT_PREFIX + replace_extension(path, '.d.ts'), // assuming JSDoc types
				default: IMPORT_PREFIX + path,
			};
		} else if (path.endsWith('.svelte')) {
			exports['./' + path] = {
				types: IMPORT_PREFIX + path + '.d.ts',
				svelte: IMPORT_PREFIX + path,
				default: IMPORT_PREFIX + path, // needed for loader imports
			};
		} else {
			exports['./' + path] = {
				default: IMPORT_PREFIX + path,
			};
		}
	}
	return parse_or_throw_formatted_error('package.json#exports', Package_Json_Exports, exports);
};

const IMPORT_PREFIX = './' + SVELTEKIT_DIST_DIRNAME + '/';

export const parse_repo_url = (
	package_json: Package_Json,
): {owner: string; repo: string} | undefined => {
	const {repository} = package_json;
	const repo_url = repository
		? typeof repository === 'string'
			? repository
			: repository.url
		: undefined;
	if (!repo_url) {
		return;
	}
	const parsed_repo_url = GITHUB_REPO_MATCHER.exec(strip_end(strip_end(repo_url, '/'), '.git'));
	if (!parsed_repo_url) {
		return;
	}
	const [, owner, repo] = parsed_repo_url;
	return {owner, repo};
};

/**
 * Parses a `Package_Json` object but preserves the order of the original keys.
 */
const parse_package_json = (schema: typeof Package_Json, value: any): Package_Json => {
	const parsed = parse_or_throw_formatted_error('package.json', schema, value);
	const keys = Object.keys(value);
	return Object.fromEntries(
		Object.entries(parsed).sort(([a], [b]) => keys.indexOf(a) - keys.indexOf(b)),
	) as any;
};

// TODO maybe extract to zod helpers? see also everything in `task_logging.ts`
const parse_or_throw_formatted_error = <T extends z.ZodTypeAny>(
	name: string,
	schema: T,
	value: any,
): z.infer<T> => {
	const parsed = schema.safeParse(value);
	if (!parsed.success) {
		let msg = st('red', `Failed to parse ${name}:\n`);
		for (const issue of parsed.error.issues) {
			msg += st('red', `\n\t"${issue.path}" ${issue.message}\n`);
		}
		throw Error(msg);
	}
	return parsed.data;
};

export const has_dep = (
	dep_name: string,
	package_json: Package_Json = load_package_json(),
): boolean =>
	!!package_json.devDependencies?.[dep_name] ||
	!!package_json.dependencies?.[dep_name] ||
	!!package_json.peerDependencies?.[dep_name];

export interface Package_Json_Dep {
	name: string;
	version: string;
}

export const extract_deps = (package_json: Package_Json): Array<Package_Json_Dep> => {
	const deps_by_name: Map<string, Package_Json_Dep> = new Map();
	// Earlier versions override later ones, so peer deps goes last.
	const add_deps = (deps: Record<string, string> | undefined) => {
		if (!deps) return;
		for (const [name, version] of Object.entries(deps)) {
			if (!deps_by_name.has(name)) {
				deps_by_name.set(name, {name, version});
			}
		}
	};
	add_deps(package_json.dependencies);
	add_deps(package_json.devDependencies);
	add_deps(package_json.peerDependencies);
	return Array.from(deps_by_name.values());
};
