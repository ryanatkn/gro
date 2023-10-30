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

export const PackageJsonRepository = z.union([
	z.string(),
	z
		.object({
			type: z.string(),
			url: Url,
			directory: z.string().optional(),
		})
		.passthrough(),
]);
export type PackageJsonRepository = z.infer<typeof PackageJsonRepository>;

export const PackageJsonAuthor = z.union([
	z.string(),
	z
		.object({
			name: z.string(),
			email: Email.optional(),
			url: Url.optional(),
		})
		.passthrough(),
]);
export type PackageJsonAuthor = z.infer<typeof PackageJsonAuthor>;

export const PackageJsonFunding = z.union([
	z.string(),
	z
		.object({
			type: z.string(),
			url: Url,
		})
		.passthrough(),
]);
export type PackageJsonFunding = z.infer<typeof PackageJsonFunding>;

export const PackageJsonExports = z.record(z.record(z.string()).optional());
export type PackageJsonExports = z.infer<typeof PackageJsonExports>;

/**
 * @see https://docs.npmjs.com/cli/v10/configuring-npm/package-json
 */
export const PackageJson = z.intersection(
	z.record(z.unknown()),
	z
		.object({
			// according to the npm docs, `name` and `version` are the only required properties
			name: z.string(),
			version: z.string(),

			private: z
				.boolean({
					description:
						'disallow npm publish, and also used by Gro to disable `package.json` automations',
				})
				.optional(),

			description: z.string().optional(),
			license: z.string().optional(),
			homepage: Url.optional(),
			repository: z.union([z.string(), Url, PackageJsonRepository]).optional(),
			author: z.union([z.string(), PackageJsonAuthor.optional()]),
			contributors: z.array(z.union([z.string(), PackageJsonAuthor])).optional(),
			bugs: z
				.union([z.string(), z.object({url: Url.optional(), email: Email.optional()}).passthrough()])
				.optional(),
			funding: z
				.union([Url, PackageJsonFunding, z.array(z.union([Url, PackageJsonFunding]))])
				.optional(),
			keywords: z.array(z.string()).optional(),

			scripts: z.record(z.string()).optional(),

			bin: z.record(z.string()).optional(),
			files: z.array(z.string()).optional(),
			exports: PackageJsonExports.optional(),

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
export type PackageJson = z.infer<typeof PackageJson>;

export interface MapPackageJson {
	(pkg: PackageJson): PackageJson | null | Promise<PackageJson | null>;
}

export const EMPTY_PACKAGE_JSON: PackageJson = {name: '', version: ''};

export const load_package_json = async (
	dir = is_this_project_gro ? gro_paths.root : paths.root,
	cache?: Record<string, PackageJson>,
): Promise<PackageJson> => {
	let pkg: PackageJson;
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

export const sync_package_json = async (
	map_package_json: MapPackageJson,
	log: Logger,
	check = false,
	dir = paths.root,
	exports_dir = paths.lib,
): Promise<{pkg: PackageJson | null; changed: boolean}> => {
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

export const load_gro_package_json = (): Promise<PackageJson> => load_package_json(gro_paths.root);

// TODO probably make this nullable and make callers handle failures
const load_package_json_contents = (dir: string): Promise<string> =>
	readFile(join(dir, 'package.json'), 'utf8');

export const write_package_json = async (serialized_pkg: string): Promise<void> => {
	await writeFile(join(paths.root, 'package.json'), serialized_pkg);
};

export const serialize_package_json = (pkg: PackageJson): string => {
	PackageJson.parse(pkg);
	return JSON.stringify(pkg, null, 2) + '\n';
};

/**
 * Updates package.json. Writes to the filesystem only when contents change.
 */
export const update_package_json = async (
	dir = paths.root,
	update: (pkg: PackageJson) => PackageJson | null | Promise<PackageJson | null>,
	write = true,
): Promise<{pkg: PackageJson | null; changed: boolean}> => {
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
export const normalize_package_json = (pkg: PackageJson): PackageJson => {
	if (pkg.exports && Object.keys(pkg.exports).length === 0) {
		pkg.exports = undefined;
	}
	return pkg;
};

export const to_package_exports = (paths: string[]): PackageJsonExports => {
	const sorted = paths
		.slice()
		.sort((a, b) => (a === 'index.ts' ? -1 : b === 'index.ts' ? 1 : a.localeCompare(b)));
	const exports: PackageJsonExports = {};
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
	return PackageJsonExports.parse(exports);
};

const IMPORT_PREFIX = './' + SVELTEKIT_DIST_DIRNAME + '/';

export interface Package_Module_Declaration {
	name: string; // identifier
	kind: string; // `getKing()`
	// type: string; // `getType()`
}

export interface Package_Module {
	path: string;
	declarations: Package_Module_Declaration[];
}

export type Package_Modules = Record<string, Package_Module>;

// TODO refactor
export const to_package_modules = async (
	exports: PackageJsonExports | undefined,
	log?: Logger,
): Promise<Package_Modules | undefined> => {
	if (!exports) return undefined;

	const project = new Project();
	project.addSourceFilesAtPaths('src/**/*.ts'); // TODO dir?

	return Object.fromEntries(
		(
			await Promise.all(
				Object.entries(exports).map(async ([k, _v]) => {
					// TODO hacky - doesn't handle any but the normal mappings, also add a gro helper?
					const source_file_path =
						k === '.' || k === './'
							? 'index.ts'
							: strip_start(k.endsWith('.js') ? replace_extension(k, '.ts') : k, './');
					const source_file_id = paths.lib + source_file_path;
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

					const source_file = project.getSourceFileOrThrow(source_file_path);
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

					const package_module: Package_Module = {path: source_file_path, declarations};
					return [k, package_module];
				}),
			)
		).filter(Boolean),
	);
};
