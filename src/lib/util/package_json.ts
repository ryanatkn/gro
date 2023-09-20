import {join} from 'node:path';
import type {Json} from '@feltjs/util/json.js';
import {readFile, writeFile} from 'node:fs/promises';

import {
	paths,
	gro_paths,
	is_this_project_gro,
	replace_extension,
	SVELTEKIT_DIST_DIRNAME,
} from './paths.js';

// This is a single entrypoint for getting the `package.json` of both the current project and Gro.
// It's cached but can be reloaded with `force_refresh` flag.

// TODO fill out this type
export interface PackageJson {
	[key: string]: Json | undefined;
	name: string;
	main?: string;
	bin?: {[key: string]: string};
	files?: string[];
	exports?: PackageJsonExports;
}
export type PackageJsonExports = Record<string, Record<string, string>>;

let package_json: PackageJson | undefined;
let gro_package_json: PackageJson | undefined;

export const load_package_json = async (force_refresh = false): Promise<PackageJson> => {
	if (is_this_project_gro) return load_gro_package_json(force_refresh);
	if (!package_json || force_refresh) {
		package_json = JSON.parse(await readFile(join(paths.root, 'package.json'), 'utf8'));
	}
	return package_json!;
};
export const load_gro_package_json = async (force_refresh = false): Promise<PackageJson> => {
	if (!gro_package_json || force_refresh) {
		gro_package_json = JSON.parse(await readFile(join(gro_paths.root, 'package.json'), 'utf8'));
	}
	return gro_package_json!;
};

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
	update: (pkg: PackageJson) => PackageJson | Promise<PackageJson>,
): Promise<boolean> => {
	const original_pkg = await load_package_json();
	const updated_pkg = await update(original_pkg);
	const updated_serialized = serialize_package_json(updated_pkg);
	if (updated_serialized === serialize_package_json(original_pkg)) {
		return false;
	}
	await write_package_json(updated_serialized);
	return true;
};

export const update_package_json_exports = (exports: PackageJsonExports): Promise<boolean> =>
	update_package_json((pkg) => ({...pkg, exports}));

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
