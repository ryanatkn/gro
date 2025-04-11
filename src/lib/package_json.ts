import {z} from 'zod';
import {join} from 'node:path';
import {readFileSync, writeFileSync} from 'node:fs';
import {count_graphemes, plural, strip_end} from '@ryanatkn/belt/string.js';
import type {Logger} from '@ryanatkn/belt/log.js';
import type {Flavored} from '@ryanatkn/belt/types.js';
import {styleText as st} from 'node:util';

import {paths, gro_paths, IS_THIS_GRO, replace_extension} from './paths.js';
import {SVELTEKIT_DIST_DIRNAME} from './constants.js';
import {search_fs} from './search_fs.js';
import {has_sveltekit_library} from './sveltekit_helpers.js';
import {GITHUB_REPO_MATCHER} from './github.js';

// TODO @many belongs elsewhere
export const Url = z.string();
export type Url = Flavored<z.infer<typeof Url>, 'Url'>;

// TODO @many belongs elsewhere
export const Email = z.string();
export type Email = Flavored<z.infer<typeof Email>, 'Email'>;

// TODO move this where?
export const transform_empty_object_to_undefined = <T>(val: T): T | undefined => {
	if (val && Object.keys(val).length === 0) {
		return;
	}
	return val;
};

export const Package_Json_Repository = z.union([
	z.string(),
	z
		.interface({
			type: z.string(),
			url: Url,
			directory: z.string().optional(),
		})
		.passthrough(),
]);
export type Package_Json_Repository = z.infer<typeof Package_Json_Repository>;

export const Package_Json_Author = z.union([
	z.string(),
	z
		.interface({
			name: z.string(),
			email: Email.optional(),
			url: Url.optional(),
		})
		.passthrough(),
]);
export type Package_Json_Author = z.infer<typeof Package_Json_Author>;

export const Package_Json_Funding = z.union([
	z.string(),
	z
		.interface({
			type: z.string(),
			url: Url,
		})
		.passthrough(),
]);
export type Package_Json_Funding = z.infer<typeof Package_Json_Funding>;

// TODO BLOCK remove recursive schema workarounds
// Helper to create a recursive type that represents export conditions and values
const create_export_value_schema = (): z.ZodType => {
	return z.lazy(() =>
		z.union([
			z.string(),
			z.null(),
			z.record(
				z.string(),
				z.lazy(() => export_value_schema),
			),
		]),
	);
};

// The base export value schema that can be a string, null, or nested conditions
const export_value_schema = create_export_value_schema();
export const Export_Value = export_value_schema;
export type Export_Value = z.infer<typeof Export_Value>;

// Package exports can be:
// 1. A string (shorthand for main export)
// 2. null (to block exports)
// 3. A record of export conditions/paths
export const Package_Json_Exports = z.union([
	z.string(),
	z.null(),
	z.record(z.string(), export_value_schema),
]);
export type Package_Json_Exports = z.infer<typeof Package_Json_Exports>;

/**
 * @see https://docs.npmjs.com/cli/v10/configuring-npm/package-json
 */
export const Package_Json = z
	.interface({
		// according to the npm docs, `name` and `version` are the only required properties
		name: z.string(),
		version: z.string(),
		private: z
			.boolean()
			.meta({description: 'disallow publishing to the configured registry'})
			.optional(),
		public: z
			.boolean()
			.meta({
				description:
					'a Gro extension that enables publishing `.well-known/package.json` and `.well-known/src`',
			})
			.optional(),
		description: z.string().optional(),
		motto: z
			.string()
			.meta({description: "a Gro extension that's a short phrase that represents this project"})
			.optional(),
		glyph: z
			.string()
			.meta({
				description:
					"a Gro extension that's a single unicode character that represents this project",
			})
			.refine((v) => count_graphemes(v) === 1, 'must be a single unicode character')
			.optional(),
		logo: z
			.string()
			.meta({
				description:
					"a Gro extension that's a link relative to the `homepage` to an image that represents this project",
			})
			.optional(),
		logo_alt: z
			.string()
			.meta({description: "a Gro extension that's the alt text for the `logo`"})
			.optional(),
		license: z.string().optional(),
		scripts: z.record(z.string(), z.string()).optional(),
		homepage: Url.optional(),
		author: z.union([z.string(), Package_Json_Author.optional()]),
		repository: z.union([z.string(), Url, Package_Json_Repository]).optional(),
		contributors: z.array(z.union([z.string(), Package_Json_Author])).optional(),
		bugs: z
			.union([
				z.string(),
				z.interface({url: Url.optional(), email: Email.optional()}).passthrough(),
			])
			.optional(),
		funding: z
			.union([Url, Package_Json_Funding, z.array(z.union([Url, Package_Json_Funding]))])
			.optional(),
		keywords: z.array(z.string()).optional(),

		type: z.string().optional(),
		engines: z.record(z.string(), z.string()).optional(),
		os: z.array(z.string()).optional(),
		cpu: z.array(z.string()).optional(),

		dependencies: z.record(z.string(), z.string()).optional(),
		devDependencies: z.record(z.string(), z.string()).optional(),
		peerDependencies: z.record(z.string(), z.string()).optional(),
		peerDependenciesMeta: z.record(z.string(), z.interface({optional: z.boolean()})).optional(),
		optionalDependencies: z.record(z.string(), z.string()).optional(),

		bin: z.record(z.string(), z.string()).optional(),
		sideEffects: z.array(z.string()).optional(),
		files: z.array(z.string()).optional(),
		main: z.string().optional(),
		exports: Package_Json_Exports.transform(transform_empty_object_to_undefined).optional(),
	})
	.passthrough();
export type Package_Json = z.infer<typeof Package_Json>;

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
