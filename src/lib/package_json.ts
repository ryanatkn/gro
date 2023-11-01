import {z} from 'zod';
import {join} from 'node:path';
import {readFile, writeFile} from 'node:fs/promises';
import {plural, strip_start} from '@grogarden/util/string.js';
import type {Logger} from '@grogarden/util/log.js';
import {Project} from 'ts-morph';

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
import {exists} from './exists.js';

export const Package_Module_Declaration = z
	.object({
		name: z.string(), // identifier
		kind: z.string(), // `getKing()`
		// type: string; // `getType()`
	})
	.passthrough();
export type Package_Module_Declaration = z.infer<typeof Package_Module_Declaration>;

export const Package_Module = z
	.object({
		path: z.string(),
		declarations: z.array(Package_Module_Declaration),
	})
	.passthrough();
export type Package_Module = z.infer<typeof Package_Module>;

export const Package_Modules = z.record(Package_Module);
export type Package_Modules = z.infer<typeof Package_Modules>;

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

export const Package_Json_Modules = Package_Modules.optional();
export type Package_Json_Modules = z.infer<typeof Package_Json_Modules>;

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
			exports: Package_Json_Exports.optional(),
			modules: Package_Json_Modules.optional(),

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
	(pkg: Package_Json): Package_Json | null | Promise<Package_Json | null>;
}

export const EMPTY_PACKAGE_JSON: Package_Json = {name: '', version: ''};

export const load_package_json = async (
	dir = is_this_project_gro ? gro_paths.root : paths.root,
	cache?: Record<string, Package_Json>,
): Promise<Package_Json> => {
	let pkg: Package_Json;
	if (cache && dir in cache) {
		return cache[dir];
	}
	try {
		pkg = JSON.parse(await load_package_json_contents(dir));
	} catch (err) {
		throw Error('failed to load package.json at ' + dir);
	}
	if (cache) cache[dir] = pkg;
	return pkg;
};

export const load_mapped_package_json = async (
	log?: Logger,
	dir = is_this_project_gro ? gro_paths.root : paths.root,
	cache?: Record<string, Package_Json>,
): Promise<Package_Json> => {
	const package_json = await load_package_json(dir, cache);
	package_json.modules = await to_package_modules(package_json.exports, log);
	return package_json;
};

export const sync_package_json = async (
	map_package_json: Map_Package_Json,
	log: Logger,
	check = false,
	dir = paths.root,
	exports_dir = paths.lib,
): Promise<{pkg: Package_Json | null; changed: boolean}> => {
	const exported_files = await search_fs(exports_dir);
	const exported_paths = Array.from(exported_files.keys());
	const updated = await update_package_json(
		dir,
		async (pkg) => {
			const exports = to_package_exports(exported_paths);
			pkg.exports = exports;
			const mapped = await map_package_json(pkg);
			return mapped ? normalize_package_json(mapped) : mapped;
		},
		!check,
	);

	const exports_count =
		updated.changed && updated.pkg?.exports ? Object.keys(updated.pkg.exports).length : 0;
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

export const write_package_json = async (serialized_pkg: string): Promise<void> => {
	await writeFile(join(paths.root, 'package.json'), serialized_pkg);
};

export const serialize_package_json = (pkg: Package_Json): string => {
	Package_Json.parse(pkg);
	return JSON.stringify(pkg, null, 2) + '\n';
};

/**
 * Updates package.json. Writes to the filesystem only when contents change.
 */
export const update_package_json = async (
	dir = paths.root,
	update: (pkg: Package_Json) => Package_Json | null | Promise<Package_Json | null>,
	write = true,
): Promise<{pkg: Package_Json | null; changed: boolean}> => {
	const original_pkg_contents = await load_package_json_contents(dir);
	const original_pkg = JSON.parse(original_pkg_contents);
	const updated_pkg = await update(original_pkg);
	if (updated_pkg === null) {
		return {pkg: original_pkg, changed: false};
	}
	const updated_contents = serialize_package_json(updated_pkg);
	if (updated_contents === original_pkg_contents) {
		return {pkg: original_pkg, changed: false};
	}
	if (write) await write_package_json(updated_contents);
	return {pkg: updated_pkg, changed: true};
};

// TODO do this with zod?
/**
 * Mutates `pkg` to normalize it for convenient usage.
 * For example, users don't have to worry about empty `exports` objects,
 * which fail schema validation.
 */
export const normalize_package_json = (pkg: Package_Json): Package_Json => {
	if (pkg.exports && Object.keys(pkg.exports).length === 0) {
		pkg.exports = undefined;
	}
	return pkg;
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

// TODO refactor
export const to_package_modules = async (
	exports: Package_Json_Exports | undefined,
	log?: Logger,
	base_path = paths.lib,
): Promise<Package_Modules | undefined> => {
	if (!exports) return undefined;

	const project = new Project();
	project.addSourceFilesAtPaths('src/**/*.ts'); // TODO dir? maybe rewrite with `base_path`?

	return Object.fromEntries(
		(
			await Promise.all(
				Object.entries(exports).map(async ([k, _v]) => {
					// TODO hacky - doesn't handle any but the normal mappings, also add a helper?
					const source_file_path =
						k === '.' || k === './'
							? 'index.ts'
							: strip_start(k.endsWith('.js') ? replace_extension(k, '.ts') : k, './');
					if (!source_file_path.endsWith('.ts')) {
						// TODO support more than just TypeScript - probably use @sveltejs/language-tools, see how @sveltejs/package generates types
						const package_module: Package_Module = {path: source_file_path, declarations: []};
						return [k, package_module];
					}
					const source_file_id = join(base_path, source_file_path);
					if (!(await exists(source_file_id))) {
						log?.warn(
							'failed to infer source file from export path',
							k,
							'- the inferred file',
							source_file_id,
							'does not exist',
						);
						return null!;
					}

					const declarations: Package_Module_Declaration[] = [];

					const source_file = project.getSourceFile((f) =>
						f.getFilePath().endsWith(source_file_path),
					); // TODO expected this to work without the callback, according to my read of the docs it is, but `project.getSourceFile(source_file_path)` fails
					if (source_file) {
						for (const [name, decls] of source_file.getExportedDeclarations()) {
							if (!decls) continue;
							// TODO how to correctly handle multiples?
							for (const decl of decls) {
								// TODO helper
								const found = declarations.find((d) => d.name === name);
								const kind = decl.getKindName();
								if (found) {
									// TODO hacky, this only was added to prevent `TypeAliasDeclaration` from overriding `VariableDeclaration`
									if (found.kind !== 'VariableDeclaration') {
										found.kind = kind;
									}
								} else {
									// TODO more
									declarations.push({name, kind});
								}
							}
						}
					}

					const package_module: Package_Module = {path: source_file_path, declarations};
					return [k, package_module];
				}),
			)
		).filter(Boolean),
	);
};
