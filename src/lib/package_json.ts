import {join} from 'node:path';
import {readFile, writeFile} from 'node:fs/promises';

import {
	paths,
	gro_paths,
	is_this_project_gro,
	replace_extension,
	SVELTEKIT_DIST_DIRNAME,
	type Url,
	type Email,
} from './paths.js';

// TODO maybe define with Zod so we get good error messages for parsing?

/**
 * @see https://docs.npmjs.com/cli/v10/configuring-npm/package-json
 */
export interface PackageJson {
	[key: string]: unknown;

	
	// according to the npm docs, these are required
	name: string;
	version: string;

	// disallow npm publish, and also used by Gro to disable `package.json` automations
	private?: boolean;

	description?: string;
	license?: string;
	homepage?: Url;
	repository?: string | Url | PackageJsonRepository;
	author?: string | PackageJsonAuthor;
	contributors?: Array<string | PackageJsonAuthor>;
	bugs?: {url: Url; email: Email};
	funding?: Url | PackageJsonFunding | Array<Url | PackageJsonFunding>;
	keywords?: string[];

	scripts?: Record<string, string>;

	bin?: Record<string, string>;
	files?: string[];
	exports?: PackageJsonExports;

	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
	peerDependenciesMeta?: Record<string, Record<string, string>>;
	optionalDependencies?: Record<string, string>;

	engines?: Record<string, string>;
	os?: string[];
	cpu?: string[];
}

export interface PackageJsonRepository {
	type: string;
	url: Url;
	directory?: string;
}

export interface PackageJsonAuthor {
	name: string;
	email?: Email;
	url?: Url;
}

export interface PackageJsonFunding {
	type: string;
	url: Url;
}

export type PackageJsonExports = Record<string, Record<string, string>>;

export interface MapPackageJson {
	(pkg: PackageJson, when: MapPackageJsonWhen): PackageJson | null | Promise<PackageJson | null>;
}

export type MapPackageJsonWhen = 'updating_exports' | 'updating_well_known';

export const load_package_json = async (): Promise<PackageJson> =>
	is_this_project_gro
		? load_gro_package_json()
		: JSON.parse(await load_package_json_contents(paths.root));

export const load_gro_package_json = async (): Promise<PackageJson> =>
	JSON.parse(await load_package_json_contents(gro_paths.root));

// TODO probably make this nullable and make callers handle failures
const load_package_json_contents = (root_dir: string): Promise<string> =>
	readFile(join(root_dir, 'package.json'), 'utf8');

export const write_package_json = async (serialized_pkg: string): Promise<void> => {
	await writeFile(join(paths.root, 'package.json'), serialized_pkg);
};

export const serialize_package_json = (pkg: PackageJson): string =>
	JSON.stringify(pkg, null, 2) + '\n';

/**
 * Updates package.json. Writes to the filesystem only when contents change.
 * @returns boolean indicating if the file changed
 */
export const update_package_json = async (
	update: (pkg: PackageJson) => PackageJson | null | Promise<PackageJson | null>,
	write = true,
): Promise<boolean> => {
	const original_pkg_contents = await load_package_json_contents(paths.root);
	const original_pkg = JSON.parse(original_pkg_contents);
	const updated_pkg = await update(original_pkg);
	if (updated_pkg === null) return false;
	const updated_contents = serialize_package_json(updated_pkg);
	if (updated_contents === original_pkg_contents) {
		return false;
	}
	if (write) await write_package_json(updated_contents);
	return true;
};

export const to_package_exports = (paths: string[]): PackageJsonExports => {
	const sorted = paths
		.slice()
		.sort((a, b) => (a === 'index.ts' ? -1 : b === 'index.ts' ? 1 : a.localeCompare(b)));
	const exports: PackageJsonExports = {};
	for (const path of sorted) {
		if (path.endsWith('.ts')) {
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
				types: IMPORT_PREFIX + path + '.d.ts',
			};
		} else {
			exports['./' + path] = {
				default: IMPORT_PREFIX + path,
			};
		}
	}
	return exports;
};

const IMPORT_PREFIX = './' + SVELTEKIT_DIST_DIRNAME + '/';
