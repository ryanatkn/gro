import {z} from 'zod';
import {join} from 'node:path';
import {readFile, writeFile} from 'node:fs/promises';
import {plural} from '@ryanatkn/belt/string.js';
import type {Logger} from '@ryanatkn/belt/log.js';
import {strip_end} from '@ryanatkn/belt/string.js';

import {
	paths,
	gro_paths,
	is_this_project_gro,
	replace_extension,
	SVELTEKIT_DIST_DIRNAME,
	Url,
	Email,
} from './paths.js';
import {search_fs} from './search_fs.js';
import {has_sveltekit_library} from './gro_plugin_sveltekit_library.js';

// TODO move this where?
export const transform_empty_object_to_undefined = (val: any): any => {
	if (val && Object.keys(val).length === 0) {
		return undefined;
	}
	return val;
};

export const Package_Json_Repository = z.union([
	z.string(),
	z
		.object({
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
		.object({
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
		.object({
			type: z.string(),
			url: Url,
		})
		.passthrough(),
]);
export type Package_Json_Funding = z.infer<typeof Package_Json_Funding>;

export const Package_Json_Exports = z.record(z.record(z.string()).optional());
export type Package_Json_Exports = z.infer<typeof Package_Json_Exports>;

/**
 * @see https://docs.npmjs.com/cli/v10/configuring-npm/package-json
 */
export const Package_Json = z.intersection(
	z.record(z.unknown()),
	z
		.object({
			// according to the npm docs, `name` and `version` are the only required properties
			name: z.string(),
			version: z.string(),

			// Gro extensions
			public: z
				.boolean({
					description:
						'a Gro extension that enables publishing `.well-known/package.json` and `.well-known/src`',
				})
				.optional(),
			icon: z.string({description: 'a Gro extension'}).optional(), // TODO maybe base64 favicon?

			private: z.boolean({description: 'disallow npm publish'}).optional(),

			description: z.string().optional(),
			license: z.string().optional(),
			homepage: Url.optional(),
			repository: z.union([z.string(), Url, Package_Json_Repository]).optional(),
			author: z.union([z.string(), Package_Json_Author.optional()]),
			contributors: z.array(z.union([z.string(), Package_Json_Author])).optional(),
			bugs: z
				.union([z.string(), z.object({url: Url.optional(), email: Email.optional()}).passthrough()])
				.optional(),
			funding: z
				.union([Url, Package_Json_Funding, z.array(z.union([Url, Package_Json_Funding]))])
				.optional(),
			keywords: z.array(z.string()).optional(),

			scripts: z.record(z.string()).optional(),

			bin: z.record(z.string()).optional(),
			files: z.array(z.string()).optional(),
			exports: Package_Json_Exports.transform(transform_empty_object_to_undefined).optional(),

			dependencies: z.record(z.string()).optional(),
			devDependencies: z.record(z.string()).optional(),
			peerDependencies: z.record(z.string()).optional(),
			peerDependenciesMeta: z.record(z.record(z.string())).optional(),
			optionalDependencies: z.record(z.string()).optional(),

			engines: z.record(z.string()).optional(),
			os: z.array(z.string()).optional(),
			cpu: z.array(z.string()).optional(),
		})
		.passthrough(),
);
export type Package_Json = z.infer<typeof Package_Json>;

export interface Map_Package_Json {
	(package_json: Package_Json): Package_Json | null | Promise<Package_Json | null>;
}

export const EMPTY_PACKAGE_JSON: Package_Json = {name: '', version: ''};

export const load_package_json = async (
	dir = is_this_project_gro ? gro_paths.root : paths.root,
	cache?: Record<string, Package_Json>,
): Promise<Package_Json> => {
	let package_json: Package_Json;
	if (cache && dir in cache) {
		return cache[dir];
	}
	try {
		package_json = JSON.parse(await load_package_json_contents(dir));
	} catch (err) {
		throw Error('failed to load package.json at ' + dir);
	}
	if (cache) cache[dir] = package_json;
	return package_json;
};

export const sync_package_json = async (
	map_package_json: Map_Package_Json,
	log: Logger,
	check = false,
	dir = paths.root,
	exports_dir = paths.lib,
): Promise<{package_json: Package_Json | null; changed: boolean}> => {
	const exported_files = await search_fs(exports_dir);
	const exported_paths = Array.from(exported_files.keys());
	const updated = await update_package_json(
		dir,
		async (package_json) => {
			if (await has_sveltekit_library(package_json)) {
				const exports = to_package_exports(exported_paths);
				package_json.exports = exports;
			}
			const mapped = await map_package_json(package_json);
			return mapped ? Package_Json.parse(mapped) : mapped;
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

export const load_gro_package_json = (): Promise<Package_Json> => load_package_json(gro_paths.root);

// TODO probably make this nullable and make callers handle failures
const load_package_json_contents = (dir: string): Promise<string> =>
	readFile(join(dir, 'package.json'), 'utf8');

export const write_package_json = async (serialized_package_json: string): Promise<void> => {
	await writeFile(join(paths.root, 'package.json'), serialized_package_json);
};

export const serialize_package_json = (package_json: Package_Json): string => {
	Package_Json.parse(package_json);
	return JSON.stringify(package_json, null, 2) + '\n';
};

/**
 * Updates package.json. Writes to the filesystem only when contents change.
 */
export const update_package_json = async (
	dir = paths.root,
	update: (package_json: Package_Json) => Package_Json | null | Promise<Package_Json | null>,
	write = true,
): Promise<{package_json: Package_Json | null; changed: boolean}> => {
	const original_contents = await load_package_json_contents(dir);
	const original = JSON.parse(original_contents);
	const updated = await update(original);
	if (updated === null) {
		return {package_json: original, changed: false};
	}
	const updated_contents = serialize_package_json(updated);
	if (updated_contents === original_contents) {
		return {package_json: original, changed: false};
	}
	if (write) await write_package_json(updated_contents);
	return {package_json: updated, changed: true};
};

export const to_package_exports = (paths: string[]): Package_Json_Exports => {
	const sorted = paths
		.slice()
		.sort((a, b) => (a === 'index.ts' ? -1 : b === 'index.ts' ? 1 : a.localeCompare(b)));
	const exports: Package_Json_Exports = {};
	for (const path of sorted) {
		if (path.endsWith('.json.d.ts')) {
			const json_path = path.substring(0, path.length - 5);
			exports['./' + json_path] = {
				default: IMPORT_PREFIX + json_path, // assuming a matching json file
				types: IMPORT_PREFIX + path,
			};
		} else if (path.endsWith('.ts') && !path.endsWith('.d.ts')) {
			const js_path = replace_extension(path, '.js');
			const key = path === 'index.ts' ? '.' : './' + js_path;
			exports[key] = {
				default: IMPORT_PREFIX + js_path,
				types: IMPORT_PREFIX + replace_extension(path, '.d.ts'),
			};
		} else if (path.endsWith('.js')) {
			const key = path === 'index.js' ? '.' : './' + path;
			exports[key] = {
				default: IMPORT_PREFIX + path,
				types: IMPORT_PREFIX + replace_extension(path, '.d.ts'), // assuming JSDoc types
			};
		} else if (path.endsWith('.svelte')) {
			exports['./' + path] = {
				svelte: IMPORT_PREFIX + path,
				default: IMPORT_PREFIX + path, // needed for loader imports
				types: IMPORT_PREFIX + path + '.d.ts',
			};
		} else {
			exports['./' + path] = {
				default: IMPORT_PREFIX + path,
			};
		}
	}
	return Package_Json_Exports.parse(exports);
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
		return undefined;
	}
	const parsed_repo_url = /.+github.com\/(.+)\/(.+)/u.exec(
		strip_end(strip_end(repo_url, '/'), '.git'),
	);
	if (!parsed_repo_url) {
		return undefined;
	}
	const [, owner, repo] = parsed_repo_url;
	return {owner, repo};
};
